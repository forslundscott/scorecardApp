const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post(['/getLeagues'], async (req,res,next)=>{
    try{
        
        let result = await pool.request()
        .input('seasonId', sql.Int, req.body.seasonId)
        .query(`
            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from leagues as l
            LEFT join league_season as ls on l.leagueId=ls.leagueId
            where ls.seasonId = @seasonId
        `)
        console.log(result.recordset)
        res.json({ message: 'Success', leagues: result.recordset })

    }catch(err){
        next(err)
    }
})
router.post('/addLeague', async (req, res, next) => {
    // Process form data here
    try{
        await pool.request()
        .input('leagueAbbreviation', sql.VarChar, req.body.abbreviation)
        .input('leagueName', sql.VarChar, req.body.leagueName)
        .input('leagueColor', sql.VarChar, req.body.color)
        .input('seasonId', sql.Int, req.body.seasonId)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM leagues WHERE abbreviation = @leagueAbbreviation)
            BEGIN
                DECLARE @leagueId INT;
                insert into leagues (name, color, shortName, abbreviation)
                values (@leagueName,@leagueColor,@leagueName,@leagueAbbreviation);

                SET @leagueId = SCOPE_IDENTITY();

                insert into league_season (leagueId, seasonId, leagueAbbreviation)
                values (@leagueId,@seasonId,@leagueAbbreviation);
            END
            `)
        res.redirect(302,'/leagues')
    }catch(err){
        next(err)
    }
  });
router.get(['/newLeague'], async (req, res, next) => {
    try{
        
        
        let data = {
            page: `/newLeague`,
            user: req.user
            
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
        const result = await pool.request()
        .query(`
            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards
             from leagues as l
            left join league_season as ls on l.leagueId=ls.leagueId
            where seasonId in (select seasonId from seasons where active = 1)
        `)
        data.leagues = result.recordset
        console.log(data.leagues)
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});

module.exports = router;
