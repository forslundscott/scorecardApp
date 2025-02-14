// routes/users.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const pool = require(`../db`)
const sql = require('mssql'); 
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
// upload limit
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 per IP
});
router.post(['/getTeams'], async (req,res,next)=>{
    try{

        const request = pool.request()
        let result = await request
        .input('leagueId', sql.VarChar, req.body.leagueId)
        .input('seasonId', sql.VarChar, req.body.seasonId)
        .query(`
        SELECT * 
        FROM teams
        WHERE league = @leagueId
        AND seasonId = @seasonId;
        `)
        // console.log(result.recordset)
        res.json({ message: 'Success', teams: result.recordset })
        // res.redirect('back')
    }catch(err){
        next(err)
    }
})
router.post(['/addPlayer'], async (req,res,next)=>{
    try{
        let result = await pool.request()
        .input('email', sql.VarChar, req.body.email)
        .query(`select id from users
        where email = @email`)
        if(!result.recordset[0]){

            await pool.request()
            .input('firstName', sql.VarChar, req.body.firstName)
            .input('lastName', sql.VarChar, req.body.lastName)
            .input('preferredName', sql.VarChar, req.body.preferredName == '' ? req.body.firstName : req.body.preferredName)
            .input('email', sql.VarChar, req.body.email)
            .input('sport', sql.VarChar, req.body.sport)
            .input('rating', sql.Decimal(10,3), 3)
            .query(`            
            EXECUTE  [dbo].[insert_user] 
               @firstName
              ,@lastName
              ,@preferredName
              ,@email

            EXECUTE [dbo].[insert_userSportRating] 
            @sport
            ,@email
            ,@rating

            `)
        }
        if(req.body.playerType == 'Rostered'){
             await pool.request()
            .input('email', sql.VarChar, req.body.email)
            .input('teamId', sql.VarChar, req.body.teamId)
            .input('seasonId', sql.Int, req.body.seasonId)
            .query(`
            
            EXECUTE [dbo].[insert_userTeamSeason] 
               @email
              ,@teamId
              ,@seasonId
            `)
        }else{
             await pool.request()
            .input('email', sql.VarChar, req.body.email)
            .input('teamId', sql.VarChar, req.body.teamId)
            .input('seasonId', sql.Int, req.body.seasonId)
            .input('eventId', sql.Int, req.body.eventId)
            .query(`
                        
            EXECUTE [dbo].[insert_subTeamGame] 
               @email
              ,@teamId
              ,@eventId
              ,@seasonId
              
              delete from subTeamGame
              where userId = 'undefined'
            `)
        }
        // console.log(result.recordset[0])
        // await request.query(`insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName, playerType) VALUES('${req.body.team}','${req.body.firstName} ${req.body.lastName}','${req.body.firstName}${req.body.lastName}','${req.body.firstName}','${req.body.lastName}','${req.body.playerType}')`)
        res.redirect('back')
    }catch(err){
        next(err)
    }
})
router.get(['/newTeam'], async (req, res, next) => {
    try{
        const request = pool.request()
        
        let data = {
            page: `/newTeam`,
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
        result = await request
        .input('seasonId', sql.Int, data.season.seasonId)
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = @seasonId
        `)
        // console.log(req)
        
        data.leagues = result.recordset
        console.log(data)
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addTeam',uploadLimiter, upload.single('teamLogo'), async (req, res, next) => {
    try{ 
        const outputDir = path.join(__dirname, '../public/images');
        const filename = `${req.body.abbreviation}.png`;
        console.log(req.file && req.file.buffer)
        if(req.file && req.file.buffer) {
            await functions.pngUpload(req.file.buffer, filename, outputDir)
        }

        // Add team to database
        const request = pool.request()
        await request
        .input('abbreviation', sql.VarChar, req.body.abbreviation)
        .input('teamName', sql.VarChar, req.body.teamName)
        .input('leagueId', sql.VarChar, req.body.leagueId)
        .input('seasonId', sql.Int, req.body.seasonId)
        .input('color', sql.VarChar, req.body.color)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM teams WHERE id = @abbreviation)
            BEGIN
                INSERT INTO teams (id, fullName, shortName, league, seasonId, abbreviation, color)
                VALUES (@abbreviation, @teamName, @teamName, @leagueId, @seasonId, @abbreviation, @color)
            END
            `)
        res.redirect(302,'/teams')
    }catch(err){
        next(err)
    }
  });
router.post('/:teamId/roster/addPlayer', async (req,res, next)=>{
    try{
        let result = await pool.request()
        .input('email', sql.VarChar, req.body.email)
        .query(`select id from users
        where email = @email`)
        if(!result.recordset[0]){
            await pool.request()
            .input('firstName', sql.VarChar, req.body.firstName)
            .input('lastName', sql.VarChar, req.body.lastName)
            .input('preferredName', sql.VarChar, req.body.preferredName == '' ? req.body.firstName : req.body.preferredName)
            .input('email', sql.VarChar, req.body.email)
            .input('sport', sql.VarChar, 'futsal')
            .input('rating', sql.Decimal(10,3), 3)
            .query(`
                        
            EXECUTE  [dbo].[insert_user] 
               @firstName
              ,@lastName
              ,@preferredName
              ,@email

            EXECUTE [dbo].[insert_userSportRating] 
            @sport
            ,@email
            ,@rating

            `)
        }

        await pool.request()
        .input('email', sql.VarChar, req.body.email)
        .input('teamId', sql.VarChar, req.body.teamId)
        .input('seasonId', sql.Int, req.body.seasonId)
        .query(`        
        EXECUTE [dbo].[insert_userTeamSeason] 
            @email
            ,@teamId
            ,@seasonId
        `)
        console.log()
        res.redirect(`/teams/${req.params.teamId}/roster`)
        // res.redirect('back')
    }catch(err){
        next(err)
    }
});
router.get('/:teamId/roster/newPlayer', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'team/newPlayer',
            teamId: req.params.teamId
        }
        let result = await pool.request()
        .input('teamId', sql.VarChar, req.params.teamId)
        .query(`
            select season from teams
            where id = @teamId
            `)

        data.seasonId = result.recordset[0].season

        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

router.get('/:teamId/roster', async (req,res, next)=>{
    try{
        
        let data = {
            user: req.user,
            page: 'team/roster',
            userId: req.params.userId
        }
        const result = await pool.request()
        .input('teamId', sql.VarChar, req.params.teamId)
        .query(`
            select userId, preferredName,lastName
            from user_team as ut
            LEFT join users as u on ut.userId=u.ID
            left join teams as t on ut.teamId=t.id
            where teamId = @teamId
            `)
            // console.log(result.recordsets[0])
        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:teamId/editTeam', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        let data = {
            user: req.user,
            page: 'team/editTeam',
            teamId: req.params.teamId
        }
        // console.log(req)
        
        await pool.request()
        .input('fullName', sql.VarChar, req.body.fullName)
        .input('shortName', sql.VarChar, req.body.shortName)
        .input('abbreviation', sql.VarChar, req.body.abbreviation)
        .input('color', sql.VarChar, req.body.color)
        .input('leagueId', sql.VarChar, req.body.leagueId)
        .input('seasonId', sql.Int, req.body.seasonId)
        .input('teamId', sql.VarChar, req.params.teamId)
        .query(`
            UPDATE teams
            set fullName = @fullName,
            shortName = @shortName,
            abbreviation = @abbreviation,
            color = @color,
            league = @leagueId,
            season = @seasonId
            where ID = @teamId
            `)

        res.redirect(302,`/teams/${req.params.teamId}`)
    }catch(err){
        next(err)
    }
});
router.get('/:teamId/editTeam', async (req,res, next)=>{
    try{
        // console.log(`test ${req.params.userId}`)
        let data = {
            user: req.user,
            page: '/editTeam'
        }

        let result = await pool.request()
        .input('teamId', sql.VarChar, req.params.teamId)
        .query(`
            SELECT * 
            from dbo.teams
            where id = @teamId
            `)        
        data.data = result.recordset[0]
        data.data.color = functions.getHexColor(data.data.color)
        result = await pool.request()
        .query(`select * from seasons where active = 1
        `)
        data.seasons = result.recordset
        result = await pool.request()
        .input('seasonId', sql.Int, data.data.seasonId)
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = @seasonId
        `)
        // console.log(req)
        
        data.leagues = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:teamId', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'teams/details'
        }
        const result = await pool.request()
        .input('teamId', sql.VarChar, req.params.teamId)
        .query(`
            SELECT * 
            from dbo.teams
            where id = @teamId
            `)        
        data.data = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

router.get('/', async (req,res, next)=>{
    try{
        // if (req.isAuthenticated()) {
        //     // console.log(req.user)
        // }
        let data = {
            page: `teams`,
            user: req.user
        }
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        const result = await pool.request()
        .query(`
            select t.id, t.fullName, t.color, t.abbreviation, u.firstName + ' ' + u.lastName as captain, l.color as LeagueColor 
            from teams as t
            left join leagues as l on t.league=l.abbreviation
            LEFT join users as u on t.captain=u.ID
            where seasonId in (select seasonId from seasons
            where active = 1)
            ORDER by t.league, fullName
        `)
        data.teams = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});



// Export the router so it can be used in other files
module.exports = router;
