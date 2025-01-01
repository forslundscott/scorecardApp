const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post(['/getLeagues'], async (req,res,next)=>{
    try{
        const request = pool.request()
        result = await request.query(`
            select * from leagues as l
            LEFT join league_season as ls on l.abbreviation=ls.leagueId
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
        
        var data = {
            page: `/newLeague`,
            user: req.user
            
        }
        var result = await request
        .query(`select top 1 seasonName from seasons where active = 1
             and not seasonName = 'Test Season'
        `)
            data.season = result.recordset[0].seasonName
        result = await request
        .query(`select seasonName from seasons where active = 1
        `)
        data.seasons = result.recordset
        console.log(data)
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        var data = {
            
            page: 'leagues',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`select * from leagues as l
            left join league_season as ls on l.abbreviation=ls.leagueId
            where seasonId in (select seasonName from seasons where active = 1)
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
