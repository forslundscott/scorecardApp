const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post(['/getLeagues'], async (req,res,next)=>{
    try{
        const request = pool.request()
        let result = await request.query(`
            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from leagues as l
            LEFT join league_season as ls on l.leagueId=ls.leagueId
            where ls.seasonId = '${req.body.seasonId}'
        `)

        res.json({ message: 'Success', leagues: result.recordset })

    }catch(err){
        next(err)
    }
})
router.post('/addLeague', async (req, res, next) => {
    // Process form data here
    try{

        const request = pool.request()
        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM leagues WHERE abbreviation = '${req.body.abbreviation}')
            BEGIN
                insert into leagues (name, color, shortName, abbreviation)
                values ('${req.body.leagueName}','${req.body.color}','${req.body.leagueName}','${req.body.abbreviation}')
                insert into league_season (leagueId, seasonId)
                values ('${req.body.abbreviation}','${req.body.seasonId}')
            END
            `)
        res.redirect(302,'/leagues')
    }catch(err){
        next(err)
    }
  });
router.get(['/newLeague'], async (req, res, next) => {
    try{
        const request = pool.request()
        
        let data = {
            page: `/newLeague`,
            user: req.user
            
        }
        let result = await request
        .query(`select top 1 * from seasons where active = 1
             and not seasonName = 'Test Season'
        `)
            data.season = result.recordset[0]
        result = await request
        .query(`select * from seasons where active = 1
        `)
        data.seasons = result.recordset
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
            
            page: 'leagues',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`
            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards
             from leagues as l
            left join league_season as ls on l.leagueId=ls.leagueId
            where seasonId in (select seasonId from seasons where active = 1)
        `)
        data.leagues = result.recordset
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
