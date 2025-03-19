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
router.get('/site/:seasonId/:type/:league', async (req, res, next) => {
    let data = {
            league: req.params.league,
            type: req.params.type,
            page: `${req.originalUrl.split('/')[1]}`,
            user: req.user
        }
    try{
        console.log(req.hostname)
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
        let result = await pool.request()
        .input('league', sql.VarChar, req.params.league)
        .input('seasonId', sql.Int, req.params.seasonId) 
        .execute(procedureName)
        data.list = result.recordsets[0]
        // result = await pool.request()
        // .input('seasonId', sql.Int, req.params.seasonId) 
        // .query(`
        //     select top 1 *
        //     from seasons
        //     where seasonId = @seasonId
        //     `)
        // data.season = result.recordset[0]
        // result = await pool.request()
        // .input('leagueId', sql.VarChar, req.params.league)
        // .query(`
        //     select top 1 *
        //     from leagues
        //     where leagueId = @leagueId
        //     `)
        console.log(data)
        // data.league = result.recordset[0]
        res.render('standingsSite.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/:seasonId/:type/:league', async (req, res, next) => {
    let data = {
            league: req.params.league,
            type: req.params.type,
            page: `${req.originalUrl.split('/')[1]}`,
            user: req.user
        }
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
        let result = await pool.request()
        .input('league', sql.VarChar, req.params.league)
        .input('seasonId', sql.Int, req.params.seasonId) 
        .execute(procedureName)
        data.list = result.recordsets[0]
        console.log(data.list)
        result = await pool.request()
        .input('seasonId', sql.Int, req.params.seasonId) 
        .query(`
            select top 1 *
            from seasons
            where seasonId = @seasonId
            `)
        data.season = result.recordset[0]
        result = await pool.request()
        .input('leagueId', sql.VarChar, req.params.league)
        .query(`
            select top 1 *
            from leagues
            where leagueId = @leagueId
            `)
        console.log(data)
        data.league = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
        let data = {
            page: `${req.originalUrl.split('/')[1]}`,
            user: req.user,
            // leagues: result.recordset
        }
        let result = await pool.request()
                .query(`select top 1 * from seasons where active = 1
                     and not seasonName = 'Test Season'
                `)
                    data.season = result.recordset[0]
                result = await pool.request()
                .query(`select * from seasons where active = 1
                `)
                data.seasons = result.recordset
                result = await pool.request()
                .input('seasonId', sql.Int, data.season.seasonId)
                .query(`SELECT l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
                    from league_season ls
                    LEFT join leagues l on ls.leagueId=l.leagueId
                    where seasonId = @seasonId
                `)
                
                data.leagues = result.recordset


        // const result = await pool.request()
        // .query(`select shortName, abbreviation, leagueId from leagues
        //     where leagueId in (
        //     select ls.leagueId from league_season as ls
        //     left join seasons as s on ls.seasonId=s.seasonId
        //     where s.active = 1
        //     )
        // `)
        
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
});
router.post('/', async (req, res, next) => {
    try{
        res.redirect(`/standings/${req.body.seasonId}/${req.body.type}/${req.body.leagueId}`)

    }catch(err){
        console.error('Error:', err)
    }
})


// Export the router so it can be used in other files
module.exports = router;
