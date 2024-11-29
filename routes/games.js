// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const processingStatus = {};
// Define a GET route for `/users`
// router.get('*', async (req,res, next)=>{
//         console.log(req)
//         next()
//     })
router.post('/games/updateGameInfo', async (req, res, next) => {
    // Process form data here
        try{
            // var data = {
            // }
            const formData = req.body;
            console.log(formData)
            const request = pool.request()
    
            result = await request.query(`
            update games
            set Team1_ID = '${formData.Team1_ID}',
            Team2_ID = '${formData.Team2_ID}',
            scoreKeeperId = ${formData.scoreKeeper_ID == 'TBD'? null : formData.scoreKeeper_ID},
            period = ${formData.period}
            where Event_ID = '${formData.Event_ID}'
            `)
            if(formData.gameCancel){
                result = await request.query(`
                DECLARE @teamName NVARCHAR(255)
                UPDATE games
                SET status = 
                    CASE
                        WHEN CAST(period as DECIMAL) / maxperiods > cast(2 as decimal)/3 THEN 1
                        ELSE 3
                    END 
                WHERE event_id = '${formData.Event_ID}'
                AND status = 0;
                IF EXISTS (
                    SELECT 1
                    FROM games
                    WHERE event_id = '${formData.Event_ID}'
                    AND status in (1,2)
                )
                BEGIN
                    EXEC recordTeamResults '${formData.Event_ID}'
                    EXEC updateGameResults '${formData.Event_ID}'
                    IF EXISTS (
                        SELECT 1 FROM winningTeam('${req.query.Event_ID}')
                    )
                    BEGIN
                        SELECT @teamName = teamName FROM winningTeam('${req.query.Event_ID}')
                        INSERT INTO winners (TeamId, fullName, shortName, color, captain, player, email, Event_ID, paid)
                        SELECT TOP 1 Teamid, fullName, shortName, color, captain, player, email, '${req.query.Event_ID}', 'false'
                        FROM winningTeamContact(@teamName)
                        WHERE giftCards = 1
                    END
                END
                `)
                res.redirect(302,'/games')
            }else{
                result = await request.query(`
                    DECLARE @teamName NVARCHAR(255)
                    IF EXISTS (
                        SELECT 1
                        FROM games
                        WHERE event_id = '${formData.Event_ID}'
                        AND status in (1,2)
                    )
                    BEGIN
                        EXEC recordTeamResults '${formData.Event_ID}'
                        EXEC updateGameResults '${formData.Event_ID}'
                    END
                    `)
                res.json({ message: 'Data updated successfully!' });
            }
        }catch(err){
            next(err)
        }
    });
router.post('/gameInfo', async (req, res, next) => {
    // Process form data here
    try{
        var data = {
        }
        const formData = req.body;
        const request = pool.request()
        result = await request.query(`
        select * 
        from games 
        where Event_ID = '${formData.Event_ID}'

        SELECT id 
        from teams
        where league in (
            select league 
            from games
            where Event_ID = '${formData.Event_ID}'
            )
        SELECT userId,roleId,firstName,lastName, preferredName
        FROM [user_role]
        left join users on user_role.userId=users.ID
        where roleId in (select id from roles where name in ('scorekeeper'))
        order by preferredName`)
        data.game = result.recordsets[0][0]
        data.teams = result.recordsets[1]
        data.scoreKeepers = result.recordsets[2]
        res.json({ message: 'Form submitted successfully!', data: data });
    }catch(err){
        next(err)
    }
  });
router.post(['/checkEmail'], async (req,res,next)=>{
    try{
        
        const request = pool.request()
        result = await request.query(`select * from users
        where email = '${req.body.email}'`)
        console.log(result.recordset[0])
        res.json({ message: 'Success', user: result.recordset[0] })
        // res.redirect('back')
    }catch(err){
        next(err)
    }
})
router.post('/playerSearch', async (req, res) => {
    const query  = req.body.playerSearchValue;

    if (!query) {
        return res.status(400).send('Query parameter is required');
    }

    try {
        const request = pool.request()
        const result = await request.query(`
            SELECT * FROM users 
            WHERE firstName LIKE '%${query}%' 
            OR lastName LIKE '%${query}%' 
            OR preferredName LIKE '%${query}%' 
            OR email LIKE '%${query}%'
            OR firstName + ' ' + lastName LIKE '%${query}%'
            OR preferredName + ' ' + lastName LIKE '%${query}%'
        `);
        console.log(result.recordset)
        res.json(result.recordset);
    } catch (err) {
        console.error('Query failed: ', err);
        res.status(500).send('Internal server error');
    }
});
router.get(['/readyForUpload'], async (req,res, next)=>{
    try{
        var data = {
            teams: [],
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`SELECT * from dbo.gamesreadytoupload()`)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get(['/completedGames'], async (req,res, next)=>{
    try{
        var data = {
            teams: [],
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`SELECT t1.*, 
                                                t2.color as Team1Color, 
                                                t3.color as Team2Color,
                                                t4.color as LeagueColor,
                                                t5.preferredName as scoreKeeper
                                                FROM [scorecard].[dbo].[games] t1 
                                                left join teams as t2 
                                                on t1.Team1_ID=t2.id and t1.season=t2.season
                                                left join teams as t3 
                                                on t1.Team2_ID=t3.id and t1.season=t3.season
                                                LEFT join leagues as t4 on t1.league=t4.abbreviation
                                                LEFT join users as t5 on t1.scoreKeeperId=t5.ID
                                                where t1.[Status]=2`)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get(['/rescheduleGames'], async (req,res, next)=>{
    try{
        var data = {
            teams: [],
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`SELECT t1.*, 
                                                t2.color as Team1Color, 
                                                t3.color as Team2Color,
                                                t4.color as LeagueColor,
                                                t5.preferredName as scoreKeeper
                                                FROM [scorecard].[dbo].[games] t1 
                                                left join teams as t2 
                                                on t1.Team1_ID=t2.id and t1.season=t2.season
                                                left join teams as t3 
                                                on t1.Team2_ID=t3.id and t1.season=t3.season
                                                LEFT join leagues as t4 on t1.league=t4.abbreviation
                                                LEFT join users as t5 on t1.scoreKeeperId=t5.ID
                                                where t1.[Status]=3`)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get(['/timer'], async (req,res,next)=>{
    try{
        var game
        var newStartTime
        if(req.query.gameStatus == 1){
            const request = pool.request()
            const result = await request.query(`UPDATE [scorecard].[dbo].[games] 
            set [Status] = 2 
            WHERE event_Id = '${req.query.Event_ID}'`)
            res.redirect('/games/readyforupload')
        }else if(req.query.timerState == 2){
            const request = pool.request()
            const result = await request
            .query(`select * from winningTeam('${req.query.Event_ID}')`)
            if(result.recordset[0].length=1){
                await request
                .query(`insert into winners (TeamId, fullName, shortName, color, captain, player, email, Event_ID, paid)
                select top 1 Teamid,fullName,shortName,color,captain,player,email, '${req.query.Event_ID}' as Event_ID, 'false' 
                from winningTeamContact('${result.recordset[0].teamName}')
                where giftCards = 1`)
            }  
            await request.query(`UPDATE [scorecard].[dbo].[games] 
            set [Status] = 1 
            WHERE event_Id = '${req.query.Event_ID}'`)
            await request
            .query(`DECLARE @eventId varchar(max)
                    set @eventId = '${req.query.Event_ID}'
                    EXEC recordTeamResults
                    @eventId`)
            res.redirect('/games')
        } else {
            const request = pool.request()
            const result = await request
            .query(`SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = '${req.query.Event_ID}'`)
            game = result.recordset[0]
            if(req.query.timerState == 0){
                if(game.timerStartTime == 'NULL'){
                    game.timerTime = game.timePerPeriod
                }else{
                    game.timerTime = game.timerTime - (Date.now() - game.timerStartTime)
                }
            }else{
                game.timerStartTime = Date.now()
            }
            game.timerState = req.query.timerState
            await request.query(`UPDATE [scorecard].[dbo].[games] set [timerTime] = ${game.timerTime}, [timerStartTime] = ${game.timerStartTime}, [timerState] = ${game.timerState} WHERE event_Id = '${req.query.Event_ID}'`)
            res.redirect('back')
        }
    }catch(err){
        console.log(err)
        res.redirect('back')
    }
})
router.post(['/eventLog'], async (req,res,next)=>{
    try{ 
         var data = {
             page: req.route.path[0].replace('/',''),
             team1: {
                 score: 0
             },
             team2: {
                 score: 0
             }
         }
 
         const request = pool.request()
         let result
         if(req.body.type == 'makecaptain'){
             console.log('cap')
             result = await request.query(`update scorecard.dbo.teams set captain = '${req.body.playerId}' where id = '${req.body.teamName}'`)
             // res.redirect('back')
             res.json({ message: 'Reload', data: data })
         }else if(req.body.type == 'makekeeper'){
             console.log('keep')
             result = await request.query(`update scorecard.dbo.teams set keeper = '${req.body.playerId}' where id = '${req.body.teamName}'`)            
             // res.redirect('back')
             res.json({ message: 'Reload', data: data })
         }else{
             console.log(`${req.body.type == 'owngoal' ? 'myKeeper': req.body.type == 'goal' ? 'oppKeeper' : null}`)
             result = await request.query(`insert into scorecard.dbo.eventLog (playerId, 
                 teamName, realTime, periodTime, period, value, type, Event_ID, opponentKeeper, season, subseason) 
             VALUES('${req.body.playerId}','${req.body.teamName}','${req.body.realTime}',
             '${req.body.periodTime}','${req.body.period}','${req.body.value}',
             '${req.body.type}','${req.body.Event_ID}',${req.body.type == 'owngoal' ? "'"+req.body.keeper+"'": req.body.type == 'goal' ? "'"+req.body.opponentKeeper+"'" : null},
             '${req.body.season}','${req.body.subseason}')`)
             
             result = await request.query(`
             DECLARE @Team1_ID VARCHAR(255);
             DECLARE @Team2_ID VARCHAR(255)
 
             SELECT @Team1_ID = Team1_ID, 
             @Team2_ID = Team2_ID
             FROM games
             WHERE Event_ID = '${req.body.Event_ID}';
 
             Select * 
             from scorecard.dbo.rosterGameStats(
                 '${req.body.teamName}',
                 '${req.body.Event_ID}'
                 ) 
             where userId = '${req.body.playerId}'
             UNION ALL
             select * from [scorecard].[dbo].[subGameStats] ('${req.body.teamName}', '${req.body.Event_ID}')
             where userId = '${req.body.playerId}'
 
             SELECT score, @Team1_ID as teamName from scorecard.dbo.teamScore(@Team1_ID,'${req.body.Event_ID}',@Team2_ID)
             SELECT score,@Team2_ID as teamName from scorecard.dbo.teamScore(@Team2_ID,'${req.body.Event_ID}',@Team1_ID)
             `)
             try{
                 data.player = result.recordsets[0][0]
                 data.team1.team = result.recordsets[1][0].teamName
                 data.team2.team = result.recordsets[2][0].teamName
                 if(result.recordsets[1].length == 0){
                     data.team1.score = 0
                 }else{
                     data.team1.score = result.recordsets[1][0].score
                 }
                 if(result.recordsets[2].length == 0){
                     data.team2.score = 0
                 }else{
                     data.team2.score = result.recordsets[2][0].score
                 }
                 data.type = req.body.type
                 res.json({ message: 'Success', data: data })
             }catch(err){
                 console.log(err)
                 console.log(req.get('User-Agent'));
                 console.log(req.user.email)
                 console.log(req.body)
                 // res.redirect('back')
                 res.json({ message: 'Reload', data: data })
             }
         }
     }catch(err){
         console.log(err)
         // next(err)
     }
 })
 router.get(['/newGame'], async (req, res, next) => {
    try{
        const request = pool.request()
        
        var data = {
            page: `/newGame`,
            user: req.user
            
        }
        var result = await request
        .query(`select top 1 seasonName from seasons where active = 1
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
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addGame', async (req, res, next) => {
    // Process form data here
    try{
        const formData = req.body;
        const request = pool.request()
        await request.query(`EXEC newGame '${formData.startDate}', '${formData.startTime}', '${formData.court}', '${formData.team1Id}', '${formData.team2Id}', ${formData.maxPeriods}, '${formData.seasonId}', '${formData.leagueId}'`)
        res.redirect(302,'/games')
    }catch(err){
        next(err)
    }
  });
  router.post('/switchSides', async (req, res, next) => {
    // Process form data here
    try{
        const formData = req.body;
        const request = pool.request()
        await request.query(`EXEC [scorecard].[dbo].[switchSides] @eventId ='${req.body.Event_ID}'`)
        res.json({ message: 'Form submitted successfully!', data: formData });
    }catch(err){
        next(err)
    }
  });
router.post('/periodEnd', async (req, res, next) => {
    try{
        // check if it has been called for this event yet
        if(processingStatus[req.body.Event_ID]){
            res.status(409).send('Request with this id is already being processed.')
        }else {
            processingStatus[req.body.Event_ID] = true;
            var game
            const request = pool.request()
            const result = await request
            .query(`SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = '${req.body.Event_ID}'`)
            game = result.recordset[0]
            console.log(req.query)
            if(game.period===req.body.period){
                if(game.timerState == 1 && (game.timerTime-(Date.now() - game.timerStartTime)) <= 0){
                    if(game.period<game.maxPeriods){
                        game.period=game.period +1
                        game.timerState =0
                        game.timerTime = game.timePerPeriod
                    } else{
                        game.timerState = 2
                        game.timerTime = 0
                    }
                    await request.query(`UPDATE [scorecard].[dbo].[games] set [timerTime] = ${game.timerTime}, [period] = ${game.period}, [timerState] = ${game.timerState} WHERE event_Id = '${req.query.Event_ID}'`)
                    processingStatus[req.body.Event_ID] = false;
                    res.send('Request processed successfully.')
                }
            }else{
                res.status(409).send('Request with this id is already being processed.')
            }
        }
        // const csvData = await functions.exportToCSV(result.recordset);
        // console.log(csvData)
        // // Set response headers for CSV download
        // res.setHeader('Content-disposition', `'attachment; filename=${req.body.fileName}.csv'`);
        // res.set('Content-Type', 'text/csv');
        // res.status(200).send(csvData);
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/activeGame/:eventId'], async (req,res,next)=>{
    try {
        console.log(req.protocol)
        console.log(req.hostname)
        var game
        const request = pool.request()
        let eventResult = await request.query(`
            select Team1_ID, Team2_ID, Event_ID
            from games
            where Event_ID = ${req.params.eventId}
            `)
            eventResult = eventResult.recordset[0]
            console.log(eventResult)
            if(eventResult == undefined){

                res.send(`
                    <script>
                        alert("Game ${req.params.eventId} does not exist. Redirecting to games page.");
                        window.location.href = "/games";
                    </script>
                `);
                return
            }
        let result = await request.query(`
            Select * 
            from [scorecard].[dbo].[teams] 
            where id ='${eventResult.Team1_ID}' 
            and keeper in (Select userId 
                from [scorecard].[dbo].[user_team] 
                where teamid ='${eventResult.Team1_ID}'
                union all
                Select userId from [scorecard].[dbo].[subTeamGame] where teamid ='${eventResult.Team1_ID}'
                and eventId = '${eventResult.Event_ID}'
        )

            Select * 
            from [scorecard].[dbo].[teams] 
            where id ='${eventResult.Team2_ID}' 
            and keeper in (Select userId 
                from [scorecard].[dbo].[user_team] 
                where teamid ='${eventResult.Team2_ID}'
                union all
                Select userId from [scorecard].[dbo].[subTeamGame] where teamid ='${eventResult.Team2_ID}'
                and eventId = '${eventResult.Event_ID}'
        )`)
        if(result.recordsets[0].length == 0){

            await request.query(`
            update teams
            set keeper = (Select top 1 userId from [scorecard].[dbo].[user_team] where teamid ='${eventResult.Team1_ID}')
            where id = '${eventResult.Team1_ID}'
            `)
        }
        if(result.recordsets[1].length == 0){

            await request.query(`
            update teams
            set keeper = (Select top 1 userId from [scorecard].[dbo].[user_team] where teamid ='${eventResult.Team2_ID}')
            where id = '${eventResult.Team2_ID}'
            `)
        }
        result = await request.query(`EXEC [scorecard].[dbo].[getActiveGameData] @eventId ='${eventResult.Event_ID}'`)
        team1 = result.recordsets[0][0]
            team2 = result.recordsets[1][0]
            team1.players = result.recordsets[2]
            team2.players = result.recordsets[3]
            if(result.recordsets[4].length == 0){
                team1.score = 0
            }else{
                team1.score = result.recordsets[4][0].score
            }
            if(result.recordsets[5].length == 0){
                team2.score = 0
            }else{
                team2.score = result.recordsets[5][0].score
            }
            game = result.recordsets[6][0]
            // team1.priorSubs = result.recordsets[7]
            // team2.priorSubs = result.recordsets[8]
        
        if(game.timerState == 1 && (game.timerTime-(Date.now() - game.timerStartTime)) <= 0){
            if(game.period<game.maxPeriods){
                game.period=game.period +1
                game.timerState =0
                game.timerTime = game.timePerPeriod
            } else{
                game.timerState = 2
                game.timerTime = 0
            }
            await request.query(`UPDATE [scorecard].[dbo].[games] set [timerTime] = ${game.timerTime}, [period] = ${game.period}, [timerState] = ${game.timerState} WHERE event_Id = '${eventResult.Event_ID}'`)
        }
        var data = {
            teams: [],
            game: game,
            page: req.route.path[0].replace('/',''),
            Event_ID: eventResult.Event_ID,
            user: req.user
        }
        res.render('index.ejs',{data: data}) 
    } catch(err){
        next(err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        var data = {
            teams: [],
            page: 'games',
            user: req.user
        }
        console.log(req.originalUrl)

        const request = pool.request()
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        const result = await request.query(`Select * from gamesList() order by startUnixTime, location `)
        data.games = result.recordset
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
