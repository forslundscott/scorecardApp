const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post('/exportStandings', async (req, res, next) => {
    try{
        
        const request = pool.request()
        const result = await request
        .query(req.body.queryString)
        const csvData = await functions.exportToCSV(result.recordset);
        console.log(csvData)
        // Set response headers for CSV download
        res.setHeader('Content-disposition', `'attachment; filename=${req.body.fileName}.csv'`);
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvData);
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/:type/:league', async (req, res, next) => {
    try{
        // console.log(req.params)
        const request = pool.request()
        const result = await request
        .query(`DECLARE @league varchar(255)
        Set @league = '${req.params.league}'
        Execute ${req.params.type}Standings @league
        `)
        var data = {
            league: req.params.league,
            type: req.params.type,
            page: `${req.originalUrl.split('/')[1]}`,
            list: result.recordsets[0],
            user: req.user
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
        const request = pool.request()
        const result = await request
        .query(`select shortName, abbreviation from leagues
            where abbreviation in (
            select ls.leagueId from league_season as ls
            left join seasons as s on ls.seasonId=s.seasonName
            where s.active = 1
            )
        `)
        var data = {
            page: `${req.originalUrl.split('/')[1]}`,
            user: req.user,
            leagues: result.recordset
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
});
router.post('/', async (req, res, next) => {
    try{
        res.redirect(`/standings/${req.body.type}/${req.body.leagueId}`)

    }catch(err){
        console.error('Error:', err)
    }
})


// Export the router so it can be used in other files
module.exports = router;
