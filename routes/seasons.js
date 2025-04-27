const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql'); 
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/newSeason'], async (req, res, next) => {
    try{
        let data = {
            page: `/newSeason`,
            user: req.user
            
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addSeason', async (req, res, next) => {
    // Process form data here
    try{
        await pool.request()
        .input('seasonName',sql.VarChar, req.body.seasonName)
        .input('active', sql.Bit, req.body.active ? 1 : 0)
        .input('registrationOpen', sql.Bit, req.body.registrationOpen ? 1 : 0)
        .input('defaultPeriods',sql.Int, req.body.defaultPeriods)
        .input('millisPerPeriod',sql.Int, req.body.minutesPerPeriod*60000)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM seasons WHERE seasonName = @seasonName)
            BEGIN
                insert into seasons (seasonName, active, registrationOpen,defaultPeriods,millisPerPeriod)
                values (@seasonName, @active, @registrationOpen, @defaultPeriods, @millisPerPeriod)
            END
            `)
        res.redirect(302,'/seasons')
    }catch(err){
        next(err)
    }
  });
router.post(['/:seasonId/registration'], async (req, res, next) => {
    let data = {
            body: req.body,
            path: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
            user: req.user
        }
    
    try{
        // need to add transaction id from stripe session
        
        const session = await stripe.checkout.sessions.retrieve(req.body.sessionId)
        
        // throw new Error('test')
        data.metadata = session.metadata
        console.log(data)
        // const filteredKeys = Object.keys(req.body).filter(key => key.includes('leagueId'));
        // console.log(filteredKeys)

        let leaguesTeams = [];

    Object.keys(req.body).forEach(key => {
        if (key.includes('leagueId_')) {
            let remainingKey = key.replace('leagueId_', ''); // Remove 'leagueId_'
            
            // Find another key that contains the remaining part
            let matchingKey = Object.keys(req.body).find(k => k.includes(remainingKey) && k !== key);

            if (matchingKey) {
                leaguesTeams.push({
                    leagueId: remainingKey,
                    teamId: req.body[matchingKey]
                });
            }
        }
    });
    const transaction = new sql.Transaction(pool);
    data.leaguesTeams = leaguesTeams
        // Begin the transaction
        await transaction.begin();
    const result = await new sql.Request(transaction)
            .input('seasonId', sql.Int, req.params.seasonId)
            .input('userId', sql.Int, req.user.id)
            .input('registrationTime', sql.BigInt, Date.now())
            .input('sessionId', sql.VarChar, session.id)
            .input('gateway', sql.VarChar, 'Stripe')
            .input('test', sql.Bit, !session.livemode)
            .query(`
                INSERT INTO seasonRegistrations (seasonId, registrationTime, userId, transactionId, gateway, test)
                OUTPUT INSERTED.registrationId
                VALUES (@seasonId, @registrationTime, @userId, @transactionId, @gateway, @test)
            `);

        const registrationId = result.recordset[0].registrationId;
        data.registrationId = registrationId
        console.log('Registration inserted, registrationId:', registrationId);


        for (const item of leaguesTeams) {
            await new sql.Request(transaction)
                .input('registrationId', sql.Int, registrationId)
                .input('userId', sql.Int, req.user.id)
                .input('leagueId', sql.VarChar, item.leagueId)
                .input('teamId', sql.VarChar, item.teamId)
                .input('seasonId', sql.Int, req.params.seasonId)
                .input('test', sql.Bit, !session.livemode)
                .query(`
                    INSERT INTO seasonRegistration_leagueTeam (registrationId, leagueId, teamId, userId, seasonId, test)
                    VALUES (@registrationId, @leagueId, @teamId, @userId, @seasonId, @test)
                `);
        }


        await transaction.commit()
        
        res.redirect(`/seasons/${req.params.seasonId}/registration`);
    }catch(err){
        // console.log(req)
        functions.failedQuery(data,err)
        console.error('Error:', err)
    }
})
router.get(['/:seasonId/registrations'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/registrations`,
            user: req.user,
            seasonId: req.params.seasonId
        }
        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('seasonId', sql.Int, req.params.seasonId)
        .query(`

            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.leagueId
            where ls.seasonId = @seasonId
           
            select * from seasons
            where seasonId = @seasonId;
            
            select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName, u.firstName, u.lastName
            from seasonRegistration_leagueTeam as srl
            left join leagues as l on srl.leagueId = l.leagueId
            left join teams as t on srl.teamId = t.teamId
            left join users as u on srl.userId = u.id
            where srl.seasonId = @seasonId
            `)
            data.leagues = result.recordsets[0]
            data.season = result.recordsets[1][0]
            data.leaguesAlreadyRegistered = result.recordsets[2]
            for(let league of data.leagues){
                result = await pool.request()
                .input('leagueId', sql.Int, league.leagueId)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                        select t.teamId, t.fullName, t.shortName, t.abbreviation from seasonLeagueTeam as slt
                        left join teams as t on slt.teamId=t.teamId
                        where slt.leagueId = @leagueId
                        and slt.seasonId = @seasonId
                    
                        union all

                        select teamId, fullName, shortName, abbreviation from teams
                        where teamId = 1000000069
                    `)
                league.teams = result.recordset
                // console.log(league)
            }
            console.log(data.leagues[0])
        res.render('registrationsSite.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post(['/:seasonId/registration/team'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/register/team`,
            user: req.user,
            seasonId: req.params.seasonId
            
        }
        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('seasonId', sql.Int, req.params.seasonId)
        .query(`
            SELECT * from users
            WHERE ID = @userId;

            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.leagueId
            where ls.seasonId = @seasonId
            and not exists (
                select 1 
                from seasonRegistration_leagueTeam as srl 
                where srl.userId = @userId 
                    and srl.leagueId = ls.leagueId
            );
            
            select * from seasons
            where seasonId = @seasonId;
            
            select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName 
            from seasonRegistration_leagueTeam as srl
            left join leagues as l on srl.leagueId = l.leagueId
            left join teams as t on srl.teamId = t.id
            where srl.seasonId = @seasonId and srl.userId = @userId
            `)
            console.log('testing123')
            data.userAttributes = result.recordsets[0][0]
            data.userAttributes.dob = Number(data.userAttributes.dob)
            data.leagues = result.recordsets[1]
            data.season = result.recordsets[2][0]
            data.leaguesAlreadyRegistered = result.recordsets[3]
            console.log(data.leaguesAlreadyRegistered)
            data.userAttributes.allergies = data.userAttributes.allergies
            ? data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
            : [];
            data.userAttributes.medicalConditions = data.userAttributes.medicalConditions
            ? data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            : [];
            console.log(data.leagues)
            // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            for(let league of data.leagues){
                console.log(league.leagueId)
                result = await pool.request()
                .input('leagueId', sql.VarChar, `${league.leagueId}`)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                    select slt.*
                        , t.fullName as teamFullName
                        , t.shortName as teamShortName
                        , t.abbreviation as teamAbbreviation
                        , t.color as teamColor
                        ,t.keeper as teamKeeper
                        ,t.captain as teamCaptain
                        , u.preferredName as captainPreferredName
                        , u.lastName as captainLastName 
                        from seasonLeagueTeam as slt
                        left join teams as t 
                            on slt.teamId=t.teamId
                        left join users as u 
                            on t.captain=u.ID
                    where 
                        slt.leagueId = @leagueId 
                        and slt.seasonId = @seasonId
                    `)
                league.teams = result.recordset
            }
            // console.log(data.leagues[0].teams)
            res.render('seasonRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/:seasonId/registration/team'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/register/team`,
            user: req.user,
            seasonId: req.params.seasonId
            
        }

        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('seasonId', sql.Int, req.params.seasonId)
        .query(`
            SELECT * from users
            WHERE ID = @userId;

            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.leagueId
            where ls.seasonId = @seasonId
            
            select * from seasons
            where seasonId = @seasonId;
            
            select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName 
            from seasonRegistration_leagueTeam as srl
            left join leagues as l on srl.leagueId = l.leagueId
            left join teams as t on srl.teamId = t.teamId
            where srl.seasonId = @seasonId and srl.userId = @userId
            `)
            console.log('testing123')
            data.userAttributes = result.recordsets[0][0]
            data.userAttributes.dob = Number(data.userAttributes.dob)
            data.leagues = result.recordsets[1]
            data.season = result.recordsets[2][0]
            data.leaguesAlreadyRegistered = result.recordsets[3]
            console.log(data.leaguesAlreadyRegistered)
            data.userAttributes.allergies = data.userAttributes.allergies
            ? data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
            : [];
            data.userAttributes.medicalConditions = data.userAttributes.medicalConditions
            ? data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            : [];
            console.log(data.leagues)
            // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            for(let league of data.leagues){
                console.log(league.leagueId)
                result = await pool.request()
                .input('leagueId', sql.VarChar, `${league.leagueId}`)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                    select slt.*
                        , t.fullName as teamFullName
                        , t.shortName as teamShortName
                        , t.abbreviation as teamAbbreviation
                        , t.color as teamColor
                        ,t.keeper as teamKeeper
                        ,t.captain as teamCaptain
                        , u.preferredName as captainPreferredName
                        , u.lastName as captainLastName 
                        from seasonLeagueTeam as slt
                        left join teams as t 
                            on slt.teamId=t.teamId
                        left join users as u 
                            on t.captain=u.ID
                    where 
                        slt.leagueId = @leagueId 
                        and slt.seasonId = @seasonId
                        
                    `)
                league.teams = result.recordset
            }
            console.log(await functions.checkWaiverFeeDue(req.user.id))
        res.render('teamRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/:seasonId/registration'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/register`,
            user: req.user,
            seasonId: req.params.seasonId
            
        }
        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('seasonId', sql.Int, req.params.seasonId)
        .query(`
            SELECT * from users
            WHERE ID = @userId;

            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.leagueId
            where ls.seasonId = @seasonId
            
            select * from seasons
            where seasonId = @seasonId;
            
            select 
                srl.leagueId, 
                srl.teamId, 
                l.shortName as leagueShortName, 
                t.shortName as teamShortName, 
                'Registered' as type
            from 
                seasonRegistration_leagueTeam as srl
            left join 
                leagues as l on srl.leagueId = l.leagueId
            left join 
                teams as t on srl.teamId = t.teamId
            where 
                srl.seasonId = @seasonId 
                and srl.userId = @userId
                and not exists (
                    select 1 
                    from user_team ut 
                    where 
                        ut.seasonId = srl.seasonId 
                        and ut.teamId = srl.teamId 
                        and ut.userId = srl.userId
                )
            union all
            select 
                ut.leagueId, 
                ut.teamId, 
                l.shortName as leagueShortName, 
                t.shortName as teamShortName, 
                'Rostered' as type
            from 
                user_team as ut
            left join 
                leagues as l on ut.leagueId = l.leagueId
            left join 
                teams as t on ut.teamId = t.teamId
            where 
                ut.seasonId = @seasonId 
                and ut.userId = @userId

            

            `)
            console.log('testing123')
            data.userAttributes = result.recordsets[0][0]
            data.userAttributes.dob = Number(data.userAttributes.dob)
            data.leagues = result.recordsets[1]
            data.season = result.recordsets[2][0]
            data.leaguesAlreadyRegistered = result.recordsets[3]
            console.log(data.leaguesAlreadyRegistered)
            data.userAttributes.allergies = data.userAttributes.allergies
            ? data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
            : [];
            data.userAttributes.medicalConditions = data.userAttributes.medicalConditions
            ? data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            : [];
            console.log(data.leagues)
            // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            for(let league of data.leagues){
                console.log(league.leagueId)
                result = await pool.request()
                .input('leagueId', sql.VarChar, `${league.leagueId}`)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                    select slt.*
                        , t.fullName as teamFullName
                        , t.shortName as teamShortName
                        , t.abbreviation as teamAbbreviation
                        , t.color as teamColor
                        ,t.keeper as teamKeeper
                        ,t.captain as teamCaptain
                        , u.preferredName as captainPreferredName
                        , u.lastName as captainLastName 
                        from seasonLeagueTeam as slt
                        left join teams as t 
                            on slt.teamId=t.teamId
                        left join users as u 
                            on t.captain=u.ID
                    where 
                        slt.leagueId = @leagueId 
                        and slt.seasonId = @seasonId
                        and t.status = 'active'
                    `)
                league.teams = result.recordset
            }
            // console.log(data.leagues[0].teams)
        res.render('seasonRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/:seasonId'], async (req, res, next) => {
    try{
        let data = {
            page: `season/details`,
            user: req.user
            
        }
        // const result = await pool.request()
        // .input('userId', sql.Int, data.user.id)
        // .query(`
        //     SELECT * from users
        //     WHERE ID = @userId;
        //     `)
        //     data.userAttributes = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            
            page: 'seasons',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`select * from seasons
            order by active desc
        `)
        data.seasons = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});

module.exports = router;
