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
        select slt.seasonId, slt.leagueId, t.fullName,t.shortName,t.color,t.keeper,t.captain, t.abbreviation, t.teamId 
        from seasonleagueteam slt
        left join teams as t on slt.teamId=t.teamId
        WHERE slt.leagueId = @leagueId
        AND slt.seasonId = @seasonId;
        `)
        console.log(result.recordset)
        res.json({ message: 'Success', teams: result.recordset })
    }catch(err){
        next(err)
    }
})
router.post(['/addPlayerToDatabase'], async (req,res,next)=>{
    try{
        console.log('test')
        let result = await pool.request()
        .input('email', sql.VarChar, req.body.email)
        .query(`select * from users
        where email = @email`)
        if(!result.recordset[0]){

            await pool.request()
            .input('firstName', sql.VarChar, req.body.firstName)
            .input('lastName', sql.VarChar, req.body.lastName)
            .input('preferredName', sql.VarChar, req.body.preferredName == '' ? req.body.firstName : req.body.preferredName)
            .input('email', sql.VarChar, req.body.email)
            .input('sport', sql.VarChar, req.body.sport ?? 'soccer')
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
        console.log(result.recordset[0])
        res.json({ message: 'Form submitted successfully!', data: result.recordset[0] });
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
            .input('sport', sql.VarChar, req.body.sport ?? 'soccer')
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
            console.log('rostered')
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
        .query(`SELECT l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from league_season ls
            LEFT join leagues l on ls.leagueId=l.leagueId
            where seasonId = @seasonId
        `)
        
        data.leagues = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addTeam',uploadLimiter, upload.single('teamLogo'), async (req, res, next) => {
    try{ 
        
        const teamId = await functions.addTeam(req.body)
        functions.commitTeam()
        if(req.file){
            functions.addTeamLogo(req.file,teamId)
        }
        res.redirect(302,'/teams')
    }catch(err){
        next(err)
    }
  });
  router.post('/teamSearch', async (req, res) => {
    const query  = req.body.teamSearchValue;

    if (!query) {
        return res.status(400).send('Query parameter is required');
    }

    try {
        const result = await pool.request()
        .input('searchValue', sql.VarChar, req.body.teamSearchValue)
        .query(`
            SELECT t.* FROM teams as t
            WHERE abbreviation LIKE '%' + @searchValue + '%' 
            OR fullName LIKE '%' + @searchValue + '%' 
            OR shortName LIKE '%' + @searchValue + '%' 
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Query failed: ', err);
        res.status(500).send('Internal server error');
    }
});
router.get('/site/myteams', checkAuthenticated, async (req,res, next)=>{
    try{
        // if (req.isAuthenticated()) {
        //     // console.log(req.user)
        // }
        let data = {
            page: `teams`,
            user: req.user
        }
        const result = await pool.request()
        .input('userId',sql.Int,req.user.id)
        .query(`
                        select t.id
            , t.fullName as teamFullName
            , t.color
            , t.abbreviation as teamAbbreviation
            , u.firstName + ' ' + u.lastName as captain
            , l.color as LeagueColor
            , t.teamId
            , l.shortName as leagueShortName
            , l.abbreviation as leagueAbbreviation
            ,s.seasonName
            from seasonLeagueTeam as slt 
            left join  teams as t on slt.teamId=t.teamId
            left join leagues as l on slt.leagueId=l.leagueId
            LEFT join users as u on t.captain=u.ID
            LEFT join seasons as s on slt.seasonId=s.seasonId
            where slt.seasonId in (select seasonId from seasons
            where active = 1)
            and t.teamId in (
                select teamId from user_team as ut
                where ut.userId = @userId and ut.seasonId = slt.seasonId
            )
            ORDER by t.league, fullName
        `)
        data.teams = result.recordset
        res.render('myTeamsSite.ejs',{data: data}) 
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
        res.redirect(`/teams/${req.params.teamId}/roster`)
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
            select ut.userId, preferredName,lastName
            from user_team as ut
            LEFT join users as u on ut.userId=u.ID
            left join teams as t on ut.teamId=t.id
            where ut.teamId = @teamId
            `)        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:teamId/editTeam', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'team/editTeam',
            teamId: req.params.teamId
        }     
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
        .query(`SELECT l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards
            from league_season ls
            LEFT join leagues l on ls.leagueId=l.leagueId
            where seasonId = @seasonId
        `)
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
        const result = await pool.request()
        .query(`
            select t.id, t.fullName, t.color, t.abbreviation, u.firstName + ' ' + u.lastName as captain, l.color as LeagueColor, t.teamId
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
