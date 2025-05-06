// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const processingStatus = {};

router.post('/updateGameInfo', async (req, res, next) => {
    // Process form data here
        try{

            const formData = req.body;    
            await pool.request()
            .input('team1Id', sql.VarChar, formData.Team1_ID)
            .input('team2Id', sql.VarChar, formData.Team2_ID)
            .input('scoreKeeperId', sql.VarChar, formData.scoreKeeper_ID == 'TBD'? null : formData.scoreKeeper_ID)
            .input('monitorId', sql.VarChar, formData.monitorId == 'TBD'? null : formData.monitorId)
            .input('referee1Id', sql.VarChar, formData.ref1Id == 'TBD'? null : formData.ref1Id)
            .input('referee2Id', sql.VarChar, formData.ref2Id == 'TBD'? null : formData.ref2Id)
            .input('period', sql.Int, formData.period)
            .input('startDate',sql.VarChar,formData.startDate)
            .input('startTime',sql.VarChar,formData.startTime)
            .input('court',sql.VarChar,formData.court)
            .input('eventId', sql.Int, formData.Event_ID)
            .query(`
            update games
            set Team1_ID = @team1Id,
            Team2_ID = @team2Id,
            scoreKeeperId = @scoreKeeperId,
            monitorId = @monitorId,
            referee1Id = @referee1Id,
            referee2Id = @referee2Id,
            period = @period,
            Location = @court,
            startUnixTime = cast(datediff(second, '1/1/1970',convert(datetime, @startDate + ' ' + @startTime) at time zone + 'Eastern Standard Time') as bigint)*1000
            where Event_ID = @eventId
            `)
            if(formData.gameCancel){
                await pool.request()
                .input('eventId', sql.Int, formData.Event_ID)
                .query(`
                DECLARE @teamName NVARCHAR(255)
                UPDATE games
                SET status = 
                    CASE
                        WHEN CAST(period as DECIMAL) / maxperiods > cast(2 as decimal)/3 THEN 1
                        ELSE 3
                    END 
                WHERE event_id = @eventId
                AND status = 0;
                IF EXISTS (
                    SELECT 1
                    FROM games
                    WHERE event_id = @eventId
                    AND status in (1,2)
                )
                BEGIN
                    EXEC recordTeamResults @eventId
                    EXEC updateGameResults @eventId
                    IF EXISTS (
                        SELECT 1 FROM winningTeam(@eventId)
                    )
                    BEGIN
                        SELECT @teamName = teamName FROM winningTeam(@eventId)
                        INSERT INTO winners (TeamId, fullName, shortName, color, captain, player, email, Event_ID, paid)
                        SELECT TOP 1 Teamid, fullName, shortName, color, captain, player, email, @eventId, 'false'
                        FROM winningTeamContact(@teamName)
                        WHERE giftCards = 1
                    END
                END
                `)
                res.redirect(302,'/games')
            }else{
                await pool.request()
                .input('eventId', sql.Int, formData.Event_ID)
                .query(`
                    DECLARE @teamName NVARCHAR(255)
                    IF EXISTS (
                        SELECT 1
                        FROM games
                        WHERE event_id = @eventId
                        AND status in (1,2)
                    )
                    BEGIN
                        EXEC recordTeamResults @eventId
                        EXEC updateGameResults @eventId
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
        let data = {
        }
        const formData = req.body;
        let result = await pool.request()
        .input('eventId', sql.Int, formData.Event_ID)
        .query(`
        select * 
        from games 
        where Event_ID = @eventId

        SELECT t.teamId, t.abbreviation  
        from teams as t
        left join seasonleagueteam as slt on t.teamId=slt.teamId
        where slt.leagueId in (
            select leagueId 
            from games
            where Event_ID = @eventId
            )

        SELECT userId,roleId,firstName,lastName, preferredName
        FROM [user_role]
        left join users on user_role.userId=users.ID
        where roleId in (select id from roles where name in ('scorekeeper'))
        order by preferredName

        SELECT userId,roleId,firstName,lastName, preferredName
        FROM [user_role]
        left join users on user_role.userId=users.ID
        where roleId in (select id from roles where name in ('monitor'))
        order by preferredName

        SELECT userId,roleId,firstName,lastName, preferredName
        FROM [user_role]
        left join users on user_role.userId=users.ID
        where roleId in (select id from roles where name in ('referee'))
        order by preferredName
        
        `)
        data.game = result.recordsets[0][0]
        data.teams = result.recordsets[1]
        data.scoreKeepers = result.recordsets[2]
        data.monitors = result.recordsets[3]
        data.referees = result.recordsets[4]
        res.json({ message: 'Form submitted successfully!', data: data });
    }catch(err){
        next(err)
    }
  });
router.post(['/checkEmail'], async (req,res,next)=>{
    try{
        let result = await pool.request()
        .input('email', sql.VarChar, req.body.email)
        .query(`select * from users
        where email = @email`)
  
        res.json({ message: 'Success', user: result.recordset[0] })
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
        const result = await pool.request()
        .input('searchValue', sql.VarChar, req.body.playerSearchValue)
        .query(`
            SELECT * FROM users 
            WHERE firstName LIKE '%' + @searchValue + '%' 
            OR lastName LIKE '%' + @searchValue + '%' 
            OR preferredName LIKE '%' + @searchValue + '%' 
            OR email LIKE '%' + @searchValue + '%'
            OR firstName + ' ' + lastName LIKE '%' + @searchValue + '%'
            OR preferredName + ' ' + lastName LIKE '%' + @searchValue + '%'
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Query failed: ', err);
        res.status(500).send('Internal server error');
    }
});
router.get(['/readyForUpload'], async (req,res, next)=>{
    try{
        let data = {
            teams: [],
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        const result = await pool.request().query(`Select * from gamesList(1) order by startUnixTime, location `)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get(['/completedGames'], async (req,res, next)=>{
    try{
        let data = {
            teams: [],
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        const result = await pool.request()
        .query(`
            Select * from gamesList(2) order by startUnixTime, location 
            `)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get(['/rescheduleGames'], async (req,res, next)=>{
    try{
        let data = {
            teams: [],
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        const result = await pool.request().query(`
            SELECT t1.*, 
            t2.color as Team1Color, 
            t3.color as Team2Color,
            t4.color as LeagueColor,
            t5.preferredName as scoreKeeper
            FROM [scorecard].[dbo].[games] t1 
            left join teams as t2 
            on t1.Team1_ID=t2.id and t1.season=t2.seasonId
            left join teams as t3 
            on t1.Team2_ID=t3.id and t1.season=t3.seasonId
            LEFT join leagues as t4 on t1.leagueId=t4.leagueId
            LEFT join users as t5 on t1.scoreKeeperId=t5.ID
            where t1.[Status]=3
        `)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get(['/timer'], async (req,res,next)=>{
    try{
        let game
        if(req.query.gameStatus == 1){
            await pool.request()
            .input('eventId', sql.Int, req.query.Event_ID)
            .query(`UPDATE [scorecard].[dbo].[games] 
            set [Status] = 2 
            WHERE event_Id = @eventId`)
            res.redirect('/games/readyforupload')
        }else if(req.query.timerState == 2){
            // not needed anymore
            // const result = await pool.request()
            // .input('eventId', sql.Int, req.query.Event_ID)
            // .query(`select * from winningTeam(@eventId)`)
            // if(result.recordset[0].length==1){
            //     await pool.request()
            //     .input('eventId', sql.Int, req.query.Event_ID)
            //     .input('teamName',sql.VarChar,result.recordset[0].teamName)
            //     .query(`insert into winners (TeamId, fullName, shortName, color, captain, player, email, Event_ID, paid)
            //     select top 1 Teamid,fullName,shortName,color,captain,player,email, @eventId as Event_ID, 'false' 
            //     from winningTeamContact(@teamName)
            //     where giftCards = 1`)
            // }  
            await pool.request()
            .input('eventId', sql.Int, req.query.Event_ID)
            .query(`UPDATE [scorecard].[dbo].[games] 
            set [Status] = 1 
            WHERE event_Id = @eventId`)
            await pool.request()
            .input('eventId', sql.Int, req.query.Event_ID)
            .query(`
                EXEC recordTeamResults
                    @eventId`)
            res.redirect('/games')
        } else {
            const result = await pool.request()
            .input('eventId', sql.Int, req.query.Event_ID)
            .query(`SELECT * 
                FROM [scorecard].[dbo].[games] 
                WHERE event_Id = @eventId`)
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
            await pool.request()
            .input('eventId', sql.Int, req.query.Event_ID)
            .input('timerTime', sql.Int, game.timerTime)
            .input('timerState', sql.Int, game.timerState)
            .input('timerStartTime', sql.BigInt, game.timerStartTime)
            .query(`UPDATE [scorecard].[dbo].[games]
                set [timerTime] = @timerTime, 
                [timerStartTime] = @timerStartTime, 
                [timerState] = @timerState
                WHERE event_Id = @eventId`)
            res.redirect('back')
        }
    }catch(err){
        console.log(err)
        res.redirect('back')
    }
})
router.post(['/eventLog'], async (req,res,next)=>{
    try{ 
         let data = {
             page: req.route.path[0].replace('/',''),
             team1: {
                 score: 0
             },
             team2: {
                 score: 0
             }
         }
         let result
         if(req.body.type == 'makecaptain'){
             await pool.request()
             .input('playerId', sql.Int, req.body.playerId)
             .input('teamName',sql.VarChar, req.body.teamName)
             .query(`update scorecard.dbo.teams set captain = @playerId where teamId = @teamName`)
             res.json({ message: 'Reload', data: data })
         }else if(req.body.type == 'makekeeper'){
             await pool.request()
             .input('playerId', sql.Int, req.body.playerId)
             .input('teamName',sql.VarChar, req.body.teamName)
             .query(`update scorecard.dbo.teams set keeper = @playerId where teamId = @teamName`)            
             res.json({ message: 'Reload', data: data })
         }else{
             await pool.request()
             .input('playerId', sql.Int, req.body.playerId)
             .input('teamName',sql.VarChar, req.body.teamName)
             .input('realTime', sql.BigInt, req.body.realTime)
             .input('periodTime',sql.VarChar,req.body.periodTime)
             .input('period',sql.Int, req.body.period)
             .input('value',sql.Int, req.body.value)
             .input('type', sql.VarChar, req.body.type)
             .input('eventId', sql.VarChar, req.body.Event_ID)
             .input('opponentKeeper',sql.VarChar, req.body.type == 'owngoal' ? req.body.keeper: req.body.type == 'goal' ? req.body.opponentKeeper : null)
             .input('season',sql.VarChar,req.body.season)
             .input('subseason',sql.VarChar,req.body.subseason)
             .query(`insert into scorecard.dbo.eventLog (playerId, 
                 teamName, realTime, 
                 periodTime, period, 
                 value, type, 
                 Event_ID, opponentKeeper, 
                 season, subseason) 
             VALUES(@playerId,@teamName,@realTime,
             @periodTime,@period,@value,
             @type,@eventId,@opponentKeeper,
             @season,@subseason)`)
             
             result = await pool.request()
             .input('playerId', sql.Int, req.body.playerId)
             .input('teamName',sql.VarChar, req.body.teamName)
             .input('eventId', sql.Int, req.body.Event_ID)
             .input('seasonId',sql.VarChar,req.body.season)
             .query(`
             DECLARE @Team1_ID VARCHAR(255);
             DECLARE @Team2_ID VARCHAR(255)
 
             SELECT @Team1_ID = Team1_ID, 
             @Team2_ID = Team2_ID
             FROM games
             WHERE Event_ID = @eventId;
 
             Select * 
             from scorecard.dbo.rosterGameStats(
                 @teamName,
                 @eventId,
                 @seasonId
                 ) 
             where userId = @playerId
             UNION ALL
             select * from [scorecard].[dbo].[subGameStats] (@teamName, @eventId)
             where userId = @playerId
 
             SELECT score, @Team1_ID as teamName from scorecard.dbo.teamScore(@Team1_ID,@eventId,@Team2_ID)
             SELECT score,@Team2_ID as teamName from scorecard.dbo.teamScore(@Team2_ID,@eventId,@Team1_ID)
             `)
             try{
                 data.player = result.recordsets[0][0]
                 console.log(data.player)
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
        let data = {
            page: `/newGame`,
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
        result = await pool.request()
        .input('seasonId',sql.Int,data.season.seasonId)
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
router.post('/addGame', async (req, res, next) => {
    // Process form data here
    try{
        const formData = req.body;
        await pool.request()
        .input('startDate',sql.VarChar,formData.startDate)
        .input('startTime',sql.VarChar,formData.startTime)
        .input('court',sql.VarChar,formData.court)
        .input('team1Id',sql.VarChar,formData.team1Id)
        .input('team2Id',sql.VarChar,formData.team2Id)
        .input('maxPeriods',sql.Int,formData.maxPeriods)
        .input('seasonId',sql.VarChar,formData.seasonId)
        .input('leagueId',sql.VarChar,formData.leagueId)
        .query(`EXEC newGame @startDate
            , @startTime
            , @court
            , @team1Id
            , @team2Id
            , @maxPeriods
            , @seasonId
            , @leagueId`)
        res.redirect(302,'/games')
    }catch(err){
        next(err)
    }
  });
  router.post('/switchSides', async (req, res, next) => {
    // Process form data here
    
    try{
        const formData = req.body;
        await pool.request()
        .input('eventId', sql.Int, req.body.Event_ID)
        .query(`EXEC [scorecard].[dbo].[switchSides] @eventId`)
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
            let game
            const result = await pool.request()
            .input('eventId', sql.Int, req.body.Event_ID)
            .query(`SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = @eventId`)
            game = result.recordset[0]
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
                    await pool.request()
                    .input('eventId', sql.Int, req.body.Event_ID)
                    .input('timerTime', sql.Int, game.timerTime)
                    .input('period', sql.Int, game.period)
                    .input('timerState', sql.Int, game.timerState)
                    .query(`UPDATE [scorecard].[dbo].[games] 
                        set [timerTime] = @timerTime
                        , [period] = @period
                        , [timerState] = @timerState
                        WHERE event_Id = @eventId`)
                    processingStatus[req.body.Event_ID] = false;
                    res.send('Request processed successfully.')
                }
            }else{
                res.status(409).send('Request with this id is already being processed.')
            }
        }
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/activeGame/:eventId'], async (req,res,next)=>{
    try {
        let game
        let eventResult = await pool.request()
        .input('eventId', sql.Int, req.params.eventId)
        .query(`
            select Team1_ID, Team2_ID, Event_ID
            from games
            where Event_ID = @eventId
            `)
            eventResult = eventResult.recordset[0]
            if(eventResult == undefined){

                res.send(`
                    <script>
                        alert("Game ${req.params.eventId} does not exist. Redirecting to games page.");
                        window.location.href = "/games";
                    </script>
                `);
                return
            }
        let result = await pool.request()
        .input('eventId', sql.Int, eventResult.Event_ID)
        .input('team1Id', sql.VarChar, eventResult.Team1_ID)
        .input('team2Id', sql.VarChar, eventResult.Team2_ID)
        .query(`
            declare @seasonId int;

            select top 1 @seasonId = season from games where event_id = @eventId

            Select * 
            from [scorecard].[dbo].[teams] 
            where id =@team1Id 
            and keeper in (Select userId 
                from [scorecard].[dbo].[user_team] 
                where teamid =@team1Id
                and seasonId = @seasonId
                union all
                Select userId from [scorecard].[dbo].[subTeamGame] where teamid =@team1Id
                and eventId = @eventId
                )

            Select * 
            from [scorecard].[dbo].[teams] 
            where id =@team2Id 
            and keeper in (Select userId 
                from [scorecard].[dbo].[user_team] 
                where teamid =@team2Id
                and seasonId = @seasonId
                union all
                Select userId from [scorecard].[dbo].[subTeamGame] where teamid =@team2Id
                and eventId = @eventId
        )`)
        if(result.recordsets[0].length == 0){

            await pool.request()
            .input('eventId', sql.Int, eventResult.Event_ID)
            .input('team1Id', sql.VarChar, eventResult.Team1_ID)
            .query(`
            update teams
            set keeper = (Select top 1 userId 
            from (Select userId 
                from [scorecard].[dbo].[user_team] 
                where teamid =@team1Id
                union all
                Select userId from [scorecard].[dbo].[subTeamGame] where teamid =@team1Id
                and eventId = @eventId
                ) as t1)
            where id = @team1Id
            `)
        }
        if(result.recordsets[1].length == 0){
            await pool.request()
            .input('eventId', sql.Int, eventResult.Event_ID)
            .input('team2Id', sql.VarChar, eventResult.Team2_ID)
            .query(`
            update teams
            set keeper = (Select top 1 userId 
            from (Select userId 
                from [scorecard].[dbo].[user_team] 
                where teamid =@team2Id
                union all
                Select userId from [scorecard].[dbo].[subTeamGame] where teamid =@team2Id
                and eventId = @eventId
        ) as t2)
            where id = @team2Id
            `)
        }
        result = await pool.request()
        .input('eventId', sql.Int, eventResult.Event_ID)
        .query(`EXEC [scorecard].[dbo].[getActiveGameData] @eventId`)
            let team1 = result.recordsets[0][0]
            let team2 = result.recordsets[1][0]
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
            console.log(team1.players)
        if(game.timerState == 1 && (game.timerTime-(Date.now() - game.timerStartTime)) <= 0){
            if(game.period<game.maxPeriods){
                game.period=game.period +1
                game.timerState =0
                game.timerTime = game.timePerPeriod
            } else{
                game.timerState = 2
                game.timerTime = 0
            }
            await pool.request()
            .input('eventId', sql.Int, eventResult.Event_ID)
            .input('timerTime', sql.Int, game.timerTime)
            .input('period', sql.Int, game.period)
            .input('timerState', sql.Int, game.timerState)
            .query(`UPDATE [scorecard].[dbo].[games] 
                set [timerTime] = @timerTime
                , [period] = @period
                , [timerState] = @timerState 
                WHERE event_Id = @eventId`)
        }
        let data = {
            teams: [team1,
                team2
            ],
            game: game,
            page: req.route.path[0].replace('/',''),
            Event_ID: eventResult.Event_ID,
            user: req.user
        }
        // console.log(data)
        res.render('index.ejs',{data: data}) 
    } catch(err){
        next(err)
    }
})
router.get('/site/mygames', checkAuthenticated, async (req,res, next)=>{
    try{
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            teams: [],
            page: 'games',
            user: req.user
        }
        console.log(req.user)
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        const result = await pool.request()
        .input('userId',sql.Int,req.user.id)
        .query(`Select g.*,
                t1.abbreviation as t1Abbreviation,
                t2.abbreviation as t2Abbreviation,
                t1.shortName as t1ShortName,
                t2.shortName as t2ShortName,
                l.abbreviation as leagueAbbreviation,
                l.name as leagueName
            from gamesList(0) as g
            left join teams as t1 on g.Team1_ID=t1.teamId
            left join teams as t2 on g.Team2_ID=t2.teamId
            left join leagues as l on g.leagueId=l.leagueId
            where g.Team1_ID in (
                select teamId from user_team as ut
                where ut.userId = @userId and ut.seasonId = g.season
            )
                or 
                g.Team2_ID in (
                select teamId from user_team as ut
                where ut.userId = @userId and ut.seasonId = g.season
            )
            order by startUnixTime, location `)
            console.log(result.recordset)
            const groupedData = result.recordset.reduce((acc, game) => {
                const dateObj = new Date(Number(game.startUnixTime)); // Ensure correct conversion
                const dateOptions = { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric',
                    timeZone: 'America/New_York'  // Explicitly set EST/EDT
                };
                const date = dateObj.toLocaleDateString('en-US', dateOptions);
                // Convert time to Eastern Time in 12-hour format
                const timeOptions = { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true,
                    timeZone: 'America/New_York'  // Explicitly set EST/EDT
                };
                const time = dateObj.toLocaleTimeString('en-US', timeOptions);

            if (!acc[date]) {
                acc[date] = { date, matches: [] };
            }
            acc[date].matches.push({
                time,
                location: game.Location,
                team1Id: game.Team1_ID,
                team2Id: game.Team2_ID,
                team1Abbreviation: game.t1Abbreviation,
                team2Abbreviation: game.t2Abbreviation,
                team1ShortName: game.t1ShortName,
                team2ShortName: game.t2ShortName,
                league: game.leagueId,
                leagueName: game.leagueName,
                leagueAbbreviation: game.leagueAbbreviation
            });

            return acc;
        }, {});
        data.schedule = Object.values(groupedData)
        console.log(data.schedule[0])
        res.render('scheduleSite.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});
router.get('/site', async (req,res, next)=>{
    try{
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            teams: [],
            page: 'games',
            user: req.user
        }

        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        const result = await pool.request()
        .query(`Select g.*,
                t1.abbreviation as t1Abbreviation,
                t2.abbreviation as t2Abbreviation,
                t1.shortName as t1ShortName,
                t2.shortName as t2ShortName,
                l.abbreviation as leagueAbbreviation,
                l.name as leagueName
            from gamesList(0) as g
            left join teams as t1 on g.Team1_ID=t1.teamId
            left join teams as t2 on g.Team2_ID=t2.teamId
            left join leagues as l on g.leagueId=l.leagueId
            order by startUnixTime, location `)
            console.log(result.recordset)
            
        
        const groupedData = result.recordset.reduce((acc, game) => {
            const dateObj = new Date(Number(game.startUnixTime)); // Ensure correct conversion
            const dateOptions = { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                timeZone: 'America/New_York'  // Explicitly set EST/EDT
            };
            const date = dateObj.toLocaleDateString('en-US', dateOptions);
            // Convert time to Eastern Time in 12-hour format
            const timeOptions = { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true,
                timeZone: 'America/New_York'  // Explicitly set EST/EDT
            };
            const time = dateObj.toLocaleTimeString('en-US', timeOptions);

            if (!acc[date]) {
                acc[date] = { date, matches: [] };
            }
            acc[date].matches.push({
                time,
                location: game.Location,
                team1Id: game.Team1_ID,
                team2Id: game.Team2_ID,
                team1Abbreviation: game.t1Abbreviation,
                team2Abbreviation: game.t2Abbreviation,
                team1ShortName: game.t1ShortName,
                team2ShortName: game.t2ShortName,
                league: game.leagueId,
                leagueName: game.leagueName,
                leagueAbbreviation: game.leagueAbbreviation
            });
        
            return acc;
        }, {});
        

        data.schedule = Object.values(groupedData)
        // console.log(data.schedule[0])
        res.render('scheduleSite.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});
router.get('/', async (req,res, next)=>{
    try{
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            teams: [],
            page: 'games',
            user: req.user
        }
        console.log(req.user)
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        let sqlStr
        if(req.user?.roles.some(role => ['admin'].includes(role.name))){
             sqlStr = `Select * 
                from gamesList(0) 
                order by startUnixTime, location `
        }else{
             sqlStr = `Select *
                from gamesList(0) 
                where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date, SYSDATETIMEOFFSET() AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time')
                order by startUnixTime, location `
        }
        const result = await pool.request()
        .query(sqlStr)
        // .query(`Select * from gamesList(0) order by startUnixTime, location `)
        data.games = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});

// Export the router so it can be used in other files
module.exports = router;
