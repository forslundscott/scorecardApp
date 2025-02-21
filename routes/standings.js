const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post('/exportStandings', async (req, res, next) => {
    try{
        // This is to select the correct sql procedure to execute without dynamic sql
        const procedureMap = {
            keeper: 'keeperStandings',
            individual: 'individualStandings',
            team: 'teamStandings',
          };
        const procedureName = procedureMap[req.body.type.toLowerCase()];
        // Verifying the procedure value was set
        if (!procedureName) {
            return res.status(400).send('Invalid standings type');
        }
        const request = pool.request()
        const result = await request
        .input('league',sql.VarChar,req.body.league)
        .execute(procedureName)
        const csvData = await functions.exportToCSV(result.recordset);
        // Set response headers for CSV download
        let fileName = functions.fileNameSanitizer(`${req.body.league}_${req.body.type}_standings`)
        fileName = fileName.slice(0,251) + '.csv'
        res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.status(200).send(csvData);
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/site/:type/:league', async (req, res, next) => {
    try{
        const procedureMap = {
            keeper: 'keeperStandings',
            individual: 'individualStandings',
            team: 'teamStandings',
          };
          const procedureName = procedureMap[req.params.type.toLowerCase()];
          // Verifying the procedure value was set
          if (!procedureName) {
              return res.status(400).send('Invalid standings type');
          }
        const result = await pool.request()
        .input('league', sql.VarChar, req.params.league)
        .execute(procedureName)
        let data = {
            league: req.params.league,
            type: req.params.type,
            page: `standingsSite`,
            list: result.recordsets[0],
            user: req.user
        }
        
        res.render('standingsSite.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/:type/:league', async (req, res, next) => {
    try{
        const request = pool.request()
        const result = await request
        .query(`DECLARE @league varchar(255)
        Set @league = '${req.params.league}'
        Execute ${req.params.type}Standings @league
        `)
        let data = {
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
        console.log('test standings')
        const request = pool.request()
        const result = await request
        .query(`select shortName, abbreviation, leagueId from leagues
            where leagueId in (
            select ls.leagueId from league_season as ls
            left join seasons as s on ls.seasonId=s.seasonId
            where s.active = 1
            )
        `)
        let data = {
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
