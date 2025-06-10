const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql'); 
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')




router.post(['/:tournamentId/registration/team'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/register/team`,
            user: req.user,
            seasonId: req.params.seasonId
            
        }
        // let result = await pool.request()
        // .input('userId', sql.Int, data.user.id)
        // .input('seasonId', sql.Int, req.params.seasonId)
        // .query(`
        //     SELECT * from users
        //     WHERE ID = @userId;

        //     select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
        //     from league_season as ls 
        //     left join leagues as l 
        //         on ls.leagueId = l.leagueId
        //     where ls.seasonId = @seasonId
        //     and not exists (
        //         select 1 
        //         from seasonRegistration_leagueTeam as srl 
        //         where srl.userId = @userId 
        //             and srl.leagueId = ls.leagueId
        //     );
            
        //     select * from seasons
        //     where seasonId = @seasonId;
            
        //     select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName 
        //     from seasonRegistration_leagueTeam as srl
        //     left join leagues as l on srl.leagueId = l.leagueId
        //     left join teams as t on srl.teamId = t.id
        //     where srl.seasonId = @seasonId and srl.userId = @userId
        //     `)
        //     console.log('testing123')
        //     data.userAttributes = result.recordsets[0][0]
        //     data.userAttributes.dob = Number(data.userAttributes.dob)
        //     data.leagues = result.recordsets[1]
        //     data.season = result.recordsets[2][0]
        //     data.leaguesAlreadyRegistered = result.recordsets[3]
        //     console.log(data.leaguesAlreadyRegistered)
        //     data.userAttributes.allergies = data.userAttributes.allergies
        //     ? data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
        //     : [];
        //     data.userAttributes.medicalConditions = data.userAttributes.medicalConditions
        //     ? data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
        //     : [];
        //     console.log(data.leagues)
        //     // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
        //     // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
        //     for(let league of data.leagues){
        //         console.log(league.leagueId)
        //         result = await pool.request()
        //         .input('leagueId', sql.VarChar, `${league.leagueId}`)
        //         .input('seasonId', sql.Int, req.params.seasonId)
        //         .query(`
        //             select slt.*
        //                 , t.fullName as teamFullName
        //                 , t.shortName as teamShortName
        //                 , t.abbreviation as teamAbbreviation
        //                 , t.color as teamColor
        //                 ,t.keeper as teamKeeper
        //                 ,t.captain as teamCaptain
        //                 , u.preferredName as captainPreferredName
        //                 , u.lastName as captainLastName 
        //                 from seasonLeagueTeam as slt
        //                 left join teams as t 
        //                     on slt.teamId=t.teamId
        //                 left join users as u 
        //                     on t.captain=u.ID
        //             where 
        //                 slt.leagueId = @leagueId 
        //                 and slt.seasonId = @seasonId
        //             `)
        //         league.teams = result.recordset
        //     }
            // console.log(data.leagues[0].teams)
            res.render('seasonRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/:tournamentId/registration/team'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/register/team`,
            user: req.user,
            seasonId: req.params.seasonId
            
        }

        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('tournamentId', sql.Int, req.params.tournamentId)
        .query(`
            SELECT * from users
            WHERE ID = @userId;

            
            
            select * from tournaments
            where tournamentId = @tournamentId;
            
            --select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName 
            --from seasonRegistration_leagueTeam as srl
            --left join leagues as l on srl.leagueId = l.leagueId
            --left join teams as t on srl.teamId = t.teamId
            --where srl.seasonId = @seasonId and srl.userId = @userId
            `)
            console.log('testing123')
            data.userAttributes = result.recordsets[0][0]
            data.userAttributes.dob = Number(data.userAttributes.dob)
            // data.leagues = result.recordsets[1]
            data.tournament = result.recordsets[1][0]
            data.leaguesAlreadyRegistered = result.recordsets[2]
            console.log(data.leaguesAlreadyRegistered)
            data.userAttributes.allergies = data.userAttributes.allergies
            ? data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
            : [];
            data.userAttributes.medicalConditions = data.userAttributes.medicalConditions
            ? data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            : [];
            // console.log(data.leagues)
            // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            // for(let league of data.leagues){
            //     console.log(league.leagueId)
            //     result = await pool.request()
            //     .input('leagueId', sql.VarChar, `${league.leagueId}`)
            //     .input('seasonId', sql.Int, req.params.seasonId)
            //     .query(`
            //         select slt.*
            //             , t.fullName as teamFullName
            //             , t.shortName as teamShortName
            //             , t.abbreviation as teamAbbreviation
            //             , t.color as teamColor
            //             ,t.keeper as teamKeeper
            //             ,t.captain as teamCaptain
            //             , u.preferredName as captainPreferredName
            //             , u.lastName as captainLastName 
            //             from seasonLeagueTeam as slt
            //             left join teams as t 
            //                 on slt.teamId=t.teamId
            //             left join users as u 
            //                 on t.captain=u.ID
            //         where 
            //             slt.leagueId = @leagueId 
            //             and slt.seasonId = @seasonId
                        
            //         `)
            //     league.teams = result.recordset
            // }
            console.log(await functions.checkWaiverFeeDue(req.user.id))
        res.render('tournamentRegistration.ejs',{data: data})
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
