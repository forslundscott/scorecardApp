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
        .query(`
            IF NOT EXISTS (SELECT 1 FROM seasons WHERE seasonName = @seasonName)
            BEGIN
                insert into seasons (seasonName, active, registrationOpen)
                values (@seasonName, @active, @registrationOpen)
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
            .input('sessionId', sql.VarChar, session.payment_intent)
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

        await pool.request()
        .input('userId', sql.Int, req.user.id)
        .input('firstName', sql.VarChar, req.body.firstName)
        .input('lastName', sql.VarChar, req.body.lastName)
        // .input('preferredName', sql.VarChar, req.body.preferredName) // May add later
        .input('email', sql.VarChar, req.body.email)
        .input('phone', sql.VarChar(20), req.body.phone)
        .input('dob', sql.BigInt, new Date(req.body.dob).getTime())
        .input('gender', sql.VarChar, req.body.gender)
        .input('skill', sql.Int, req.body.skill)
        .input('discounted', sql.Bit, req.body.discounted)
        .input('shirtSize', sql.VarChar, req.body.shirtSize)
        .input('emergencyContactFirstName', sql.VarChar, req.body.emergencyContactFirstName)
        .input('emergencyContactLastName', sql.VarChar, req.body.emergencyContactLastName)
        .input('emergencyContactPhone', sql.VarChar(20), req.body.emergencyContactPhone)
        .input('emergencyContactRelationship', sql.VarChar, req.body.emergencyContactRelationship)
        .input('allergies', sql.VarChar, `${req.body.allergies}`)
        .input('medicalConditions', sql.VarChar, `${req.body.medicalConditions}`)
        .query(`
            update users
            set firstName = @firstName,
            lastName = @lastName,
            email = @email,
            phone = @phone,
            dob = @dob,
            gender = @gender,
            skill = @skill,
            discounted = @discounted,
            shirtSize = @shirtSize,
            emergencyContactFirstName = @emergencyContactFirstName,
            emergencyContactLastName = @emergencyContactLastName,
            emergencyContactPhone = @emergencyContactPhone,
            emergencyContactRelationship = @emergencyContactRelationship,
            allergies = @allergies,
            medicalConditions = @medicalConditions
            where ID = @userId
            `)

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

            select * 
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.abbreviation
            where ls.seasonId = @seasonId
            and not exists (
                select 1 
                from seasonRegistration_leagueTeam as srl 
                where srl.userId = @userId 
                    and srl.leagueId = ls.leagueId
            );
            
            select * from seasons
            where seasonId = @seasonId;
            
            select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName, u.firstName, u.lastName
            from seasonRegistration_leagueTeam as srl
            left join leagues as l on srl.leagueId = l.abbreviation
            left join teams as t on srl.teamId = t.id
            left join users as u on srl.userId = u.id
            where srl.seasonId = @seasonId
            `)
            data.leagues = result.recordsets[0]
            data.season = result.recordsets[1][0]
            data.leaguesAlreadyRegistered = result.recordsets[2]
            console.log(data)
        res.render('registrationsSite.ejs',{data: data})
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
            select * 
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.abbreviation
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
            left join leagues as l on srl.leagueId = l.abbreviation
            left join teams as t on srl.teamId = t.id
            where srl.seasonId = @seasonId and srl.userId = @userId
            `)
            
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
            console.log(data.userAttributes)
            // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            for(let league of data.leagues){
                result = await pool.request()
                .input('leagueId', sql.VarChar, league.leagueId)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                    select * from teams
                    where league = @leagueId and seasonId = @seasonId
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

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
