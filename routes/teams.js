// routes/users.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Limit file size to 2MB
  fileFilter: (req, file, cb) => {
    const isPng = file.mimetype === 'image/png';
    if (isPng) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG images are allowed'));
    }
  },
});
router.post(['/getTeams'], async (req,res,next)=>{
    try{
        console.log(req.body)
        const request = pool.request()
        result = await request.query(`
        SELECT * 
        FROM teams
        WHERE league = '${req.body.leagueId}' 
        AND season = '${req.body.seasonId}';
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

        const request = pool.request()
        var result = await request.query(`select id from users
        where email = '${req.body.email}'`)
        if(!result.recordset[0]){

            result = await request.query(`
            DECLARE @firstName varchar(255)
            DECLARE @lastName varchar(255)
            DECLARE @preferredName varchar(255)
            DECLARE @email varchar(255)
            DECLARE @userId varchar(255)
            DECLARE @sport varchar(255)
            DECLARE @rating decimal(10,3)
            DECLARE @teamId varchar(255)
            DECLARE @seasonId varchar(255)
            
            set @firstName = '${req.body.firstName}'
            set @lastName = '${req.body.lastName}'
            set @preferredName = '${req.body.preferredName == '' ? req.body.firstName : req.body.preferredName}'
            set @email = '${req.body.email}'
            set @sport = '${req.body.sport}'
            set @rating = 3
            set @teamId = '${req.body.team}'
            set @seasonId = '${req.body.season}'
            
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
            result = await request.query(`
            DECLARE @email varchar(255)
            DECLARE @teamId varchar(255)
            DECLARE @seasonId varchar(255)
            
            set @email = '${req.body.email}'
            set @teamId = '${req.body.team}'
            set @seasonId = '${req.body.season}'
            
            EXECUTE [dbo].[insert_userTeamSeason] 
               @email
              ,@teamId
              ,@seasonId
            `)
        }else{
            result = await request.query(`
            DECLARE @email varchar(255)
            DECLARE @teamId varchar(255)
            DECLARE @seasonId varchar(255)
            DECLARE @eventId varchar(255)
            
            set @email = '${req.body.email}'
            set @teamId = '${req.body.team}'
            set @seasonId = '${req.body.season}'
            set @eventId = '${req.body.eventId}'
            
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
        
        var data = {
            page: `/newTeam`,
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
        result = await request
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = '${data.season}'
        `)
        // console.log(req)
        
        data.leagues = result.recordset
        console.log(data)
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addTeam', upload.single('teamLogo'), async (req, res, next) => {
    // Process form data here
    try{
            // Validate the image file further with Sharp
        const metadata = await sharp(req.file.buffer).metadata();
        if (metadata.format !== 'png') {
        throw new Error('File is not a valid PNG image');
        }

        // Resize and optimize the PNG image
        const processedImage = await sharp(req.file.buffer)
        .resize(800, 800, { fit: sharp.fit.inside, withoutEnlargement: true })
        .png({ quality: 90 }) // Compress PNG with quality setting
        .toBuffer();

        // Save the processed image to disk
        const outputDir = path.join(__dirname, 'public/images');
        if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
        }
        const filename = `${req.body.abbreviation}.png`;
        const outputPath = path.join(outputDir, filename);
        fs.writeFileSync(outputPath, processedImage);
        const formData = req.body;
        const request = pool.request()
        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM teams WHERE id = '${req.body.abbreviation}')
            BEGIN
                INSERT INTO teams (id, fullName, shortName, league, season, abbreviation, color)
                VALUES ('${req.body.abbreviation}', '${req.body.teamName}', '${req.body.teamName}', '${req.body.leagueId}', '${req.body.seasonId}', '${req.body.abbreviation}', '${req.body.color}')
            END
            `)
        res.redirect(302,'/teams')
    }catch(err){
        next(err)
    }
  });
router.post('/:teamId/roster/addPlayer', async (req,res, next)=>{
    try{
        const request = pool.request()
        var result = await request.query(`select id from users
        where email = '${req.body.email}'`)
        if(!result.recordset[0]){
            result = await request.query(`
            DECLARE @firstName varchar(255)
            DECLARE @lastName varchar(255)
            DECLARE @preferredName varchar(255)
            DECLARE @email varchar(255)
            DECLARE @userId varchar(255)
            DECLARE @sport varchar(255)
            DECLARE @rating decimal(10,3)
            DECLARE @teamId varchar(255)
            DECLARE @seasonId varchar(255)
            
            set @firstName = '${req.body.firstName}'
            set @lastName = '${req.body.lastName}'
            set @preferredName = '${req.body.preferredName == '' ? req.body.firstName : req.body.preferredName}'
            set @email = '${req.body.email}'
            set @sport = '${req.body.sport}'
            set @rating = 3
            set @teamId = '${req.body.team}'
            set @seasonId = '${req.body.season}'
            
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

        result = await request.query(`
        DECLARE @email varchar(255)
        DECLARE @teamId varchar(255)
        DECLARE @seasonId varchar(255)
        
        set @email = '${req.body.email}'
        set @teamId = '${req.body.team}'
        set @seasonId = '${req.body.season}'
        
        EXECUTE [dbo].[insert_userTeamSeason] 
            @email
            ,@teamId
            ,@seasonId
        `)
        console.log()
        res.redirect('./')
        // res.redirect('back')
    }catch(err){
        next(err)
    }
});
router.get('/:teamId/roster/newPlayer', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'team/newPlayer',
            teamId: req.params.teamId
        }
        const request = pool.request()
        var result = await request.query(`
            select season from teams
            where id = '${req.params.teamId}'
            `)

        data.seasonId = result.recordset[0].season

        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

router.get('/:teamId/roster', async (req,res, next)=>{
    try{
        
        var data = {
            user: req.user,
            page: 'team/roster',
            userId: req.params.userId
        }
        const request = pool.request()
        const result = await request.query(`
            select userId, preferredName,lastName
            from user_team as ut
            LEFT join users as u on ut.userId=u.ID
            left join teams as t on ut.teamId=t.id
            where teamId = '${req.params.teamId}'
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
        var data = {
            user: req.user,
            page: 'team/editTeam',
            teamId: req.params.teamId
        }
        // console.log(req)
        const request = pool.request()
        const result = await request.query(`
            UPDATE teams
            set fullName = '${req.body.fullName}',
            shortName = '${req.body.shortName}',
            color = '${req.body.color}',
            league = '${req.body.leagueId}',
            season = '${req.body.seasonId}'
            where ID = '${req.params.teamId}'
            `)

        res.redirect(302,`/teams/${req.params.teamId}`)
    }catch(err){
        next(err)
    }
});
router.get('/:teamId/editTeam', async (req,res, next)=>{
    try{
        // console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: '/editTeam'
        }
        const request = pool.request()
        var result = await request.query(`
            SELECT * 
            from dbo.teams
            where id = '${req.params.teamId}'
            `)
            console.log(result.recordsets[0])
        
        data.data = result.recordset[0]
        data.data.color = functions.getHexColor(data.data.color)
        result = await request
        .query(`select seasonName from seasons where active = 1
        `)
        data.seasons = result.recordset
        result = await request
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = '${data.data.season}'
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
        // console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'teams/details'
        }
        const request = pool.request()
        const result = await request.query(`
            SELECT * 
            from dbo.teams
            where id = '${req.params.teamId}'
            `)
            console.log(result.recordsets[0])
        
        data.data = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        // if (req.isAuthenticated()) {
        //     // console.log(req.user)
        // }
        var data = {
            page: `teams`,
            user: req.user
        }
        const request = pool.request()
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        const result = await request.query(`select t.id, t.fullName, t.color, t.abbreviation, u.firstName + ' ' + u.lastName as captain, l.color as LeagueColor from teams as t
            left join leagues as l on t.league=l.abbreviation
            LEFT join users as u on t.captain=u.ID
            where season in (select seasonName from seasons
            where active = 1)
            ORDER by t.league, fullName
        `)
        data.teams = result.recordset
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
