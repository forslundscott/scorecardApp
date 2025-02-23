// routes/users.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const pool = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated } = require('../middleware/authMiddleware')
const scheduler = require('../helpers/scheduler');

const upload = multer({
    dest: 'uploads/', // Temporary folder for uploaded files
  });

router.get('/sampleUpload', (req, res, next) => {
    const sampleFilePath = path.join(__dirname, '..', 'public', 'scheduleSample.csv');
    res.download(sampleFilePath, 'scheduleSample.csv', (err) => {
        if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error downloading file');
        }
    });
})
router.post('/upload', upload.single('file'), (req, res, next) => {
    const filePath = req.file.path;
  
    // Array to hold parsed data
    const records = [];
  
    // Parse the CSV file
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        records.push(row); // Add each row to the records array
      })
      .on('end', async () => {
        // Insert data into the database (replace with your DB logic)
        for (const record of records) {
            await pool.request()
                .input('startDate',sql.VarChar,record.startDate)
                .input('startTime',sql.VarChar,record.startTime)
                .input('court',sql.VarChar,record.court)
                .input('team1Id',sql.VarChar,record.team1Id)
                .input('team2Id',sql.VarChar,record.team2Id)
                .input('maxPeriods',sql.Int,record.maxPeriods)
                .input('seasonId',sql.VarChar,record.seasonId)
                .input('leagueId',sql.VarChar,record.leagueId)
                .query(`EXEC newGame @startDate
                    , @startTime
                    , @court
                    , @team1Id
                    , @team2Id
                    , @maxPeriods
                    , @seasonId
                    , @leagueId`)
        }
        try {
          // Example: Log records to console
          console.log('Parsed Records:', records);
  
          // Clean up the uploaded file
          fs.unlinkSync(filePath);
  
          res.send('CSV file processed and data imported!');
        } catch (error) {
          console.error('Error processing file:', error);
          res.status(500).send('Error processing file');
        }
      })
      .on('error', (error) => {
        console.error('Error reading file:', error);
        res.status(500).send('Error reading file');
      });
  });
router.post('/exportSchedules', async (req, res, next) => {
    try{
        const request = pool.request()
        let result = await request
        .input('scheduleId',sql.Int,req.body.scheduleId)
        .query(`SELECT startDate as Date
        ,startTime as Time
        ,fieldId as Field
        ,team1Id as Home
        ,team2Id as Away
        , '' as Staff
        , leagueId, subLeagueId
        , type
        , DATEPART(WEEKDAY,CONVERT(date,startDate)) as weekday
        ,case
            when schedule_games.team1Id = 'TBD' then 'TBD'
            else t1.fullName
        end as HomeFullName
        ,case
            when schedule_games.team2Id = 'TBD' then 'TBD'
            else t2.fullName
        end as AwayFullName
                FROM schedule_games
                LEFT JOIN teams as t1 on schedule_games.team1Id=t1.id and schedule_games.leagueId=t1.league
                LEFT JOIN teams as t2 on schedule_games.team2Id=t2.id and schedule_games.leagueId=t2.league
            where scheduleId = @scheduleId
            ORDER by weekday, startUnixTime, fieldId`)
        const csvData = await functions.exportToCSV(result.recordset);
        console.log(csvData)
        // Set response headers for CSV download
        res.setHeader('Content-disposition', `'attachment; filename=Schedule_${req.body.scheduleId}.csv'`);
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvData);
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/new'], async (req, res, next) => {
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`DECLARE @league varchar(255)
        // Set @league = '${req.params.league}'
        // Execute ${req.params.type}Standings @league
        // `)
        console.log(req.originalUrl)
        let data = {
            page: `${req.originalUrl}`,
            user: req.user
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post(['/new'], async (req, res, next) => {
    try{

        const request = pool.request()
        let leagueList = scheduler.leagueSchedule(await getLeaguesForScheduler(req.body.sport, req.body.seasonId),parseInt(req.body.gamesPerTeam))
        let allRegularGames = []
        let allGames = []
        let allGameDays = []
        let scheduleName = req.body.scheduleName !== '' ? req.body.scheduleName : `${req.body.seasonId} ${req.body.sport}`
        let timeParts = req.body.firstGameTime.split(':')
        let firstGameTime = (timeParts[0]*3600 + timeParts[1]*60)*1000
        let dailyGameTimesCount = req.body.lastGameTime.split(':')[0]-req.body.firstGameTime.split(':')[0]+1
        let totalFields = 4
        let timeFieldList = []
        for(let i=0;i<totalFields;i++){
            // ((i)*1000*60*60)+firstGameTime
            for(let j=0;j<dailyGameTimesCount;j++){
                let timeFieldItem = {
                    timeMs: ((j)*1000*60*60)+firstGameTime
                }
                timeFieldItem.fieldNumber = i+1
                timeFieldList.push(timeFieldItem)
            }
        }
        // console.log(timeFieldList)
        let seasonStartDate = new Date(req.body.seasonStartDate)
        seasonStartDate = new Date(`${seasonStartDate.toLocaleDateString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
          })}`)
        let seasonEndDate = new Date(req.body.seasonEndDate)
        seasonEndDate = new Date(`${seasonEndDate.toLocaleDateString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        })}`)
        // console.log(`${seasonStartDate.toLocaleDateString()} to ${seasonEndDate.toLocaleDateString()}`)
        // setting match days for all leagues
        for(let league of leagueList){
            let gameDays = playableDays(seasonStartDate.toLocaleDateString(),seasonEndDate.toLocaleDateString(),league.dayOfWeek)
            let matchesPerPlayableDay = (league.scheduleMatches.length+league.playoffMatches.length)/gameDays.length
            let daysWithExtraGame = Math.round((matchesPerPlayableDay%1)*gameDays.length)
            let imatch = 0
            
            // console.log(`${league.leagueId} ${league.playoffMatches.length} ${league.scheduleMatches.length} ${matchesPerPlayableDay} ${daysWithExtraGame} ${gameDays.length}`)
            // console.log(league.teams.length);
            let allMatches = []
            allMatches = allMatches.concat(league.scheduleMatches,league.playoffMatches)
            // allMatches.push(league.scheduleMatches)
            // allMatches.push(league.playoffMatches)
            // let copyAllMatches =[...allMatches]
            // console.log(`${allMatches.length} ${copyAllMatches.length}`)
            // console.log(allMatches)
            // console.log(league.scheduleMatches.length);;
            for(let i=0;i<gameDays.length;i++){
                if(!allGameDays.some(obj => obj.getTime() === gameDays[i].getTime())){
                    allGameDays.push(gameDays[i])
                }
                if(i<daysWithExtraGame){
                    let numberOfMatches = Math.ceil(matchesPerPlayableDay)
                }else{
                    // console.log('floor');
                    let numberOfMatches = Math.floor(matchesPerPlayableDay)
                }
                // console.log(`${league.leagueId} ${numberOfMatches} ${league.totalRegularSeasonGames} ${imatch} ${league.playoffs} ${league.teams.length}`)
                for(let j=0;j<numberOfMatches;j++){
                    const counts = {};

                    // Iterate through the array of objects
                    allMatches.forEach(obj => {
                        // Extract the values from the specified properties
                        const value1 = obj.team1Id;
                        const value2 = obj.team2Id;
                        // Increment the count for value1
                        counts[value1] = (counts[value1] || 0) 

                        // Increment the count for value2
                        counts[value2] = (counts[value2] || 0) 
                        if(obj.startDate !== null){
                            if(obj.startDate.getTime() === gameDays[i].getTime()){
                                // Extract the values from the specified properties
                                // const value1 = obj.team1Id;
                                // const value2 = obj.team2Id;
                                // Increment the count for value1
                                counts[value1] = (counts[value1] || 0) + 1;

                                // Increment the count for value2
                                counts[value2] = (counts[value2] || 0) + 1;
                            }
                        }    
                    })
                    // Find the minimum count among the unique values
                    const minCount = Object.keys(counts).length > 0 ? Math.min(...Object.values(counts)) : 0;

                    // Count how many items in counts equal the minimum value
                    const minCountValues = Object.values(counts).filter(count => count === minCount).length;
                    // if(counts['BEER']){
                    //     console.log('yes')
                    // }else{
                    //     console.log('no');
                    // }
                    // console.log(counts);
                    // console.log(`${minCount} ${minCountValues}`)
                    // console.log(minCountValues)
                    // console.log(`${j} ${daysWithExtraGame} ${matchesPerPlayableDay%1} ${numberOfMatches}`);
                    let matchesNoDate = allMatches.filter(obj => obj.startDate === null)
                    matchesNoDate.sort((a, b) => {
                        const aHasTBD = a.team1Id === 'TBD' || a.team2Id === 'TBD';
                        const bHasTBD = b.team1Id === 'TBD' || b.team2Id === 'TBD';
                        
                        // Sort objects with 'TBD' first
                        if (aHasTBD && !bHasTBD) {
                            return 1;
                        } else if (!aHasTBD && bHasTBD) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });
                    for(let k=0;k<matchesNoDate.length;k++){
                        // console.log(matchesNoDate[k].team1Id)
                        // console.log(counts)
                        if(matchesNoDate[k].team1Id==='TBD'||matchesNoDate[k].team2Id==='TBD'){
                            console.log('next')
                            // matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                            // break
                        }
                        if(!counts[matchesNoDate[k].team1Id] && !counts[matchesNoDate[k].team2Id]){
                            matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                            break
                        }
                        if(counts[matchesNoDate[k].team1Id]&& counts[matchesNoDate[k].team2Id]){
                            if((counts[matchesNoDate[k].team1Id]> minCount|| counts[matchesNoDate[k].team2Id]>minCount)&&minCountValues>1){
                                console.log('next')
                            }else{
                                // console.log(counts)
                                // console.log(`${counts[matchesNoDate[k].team1Id]} ${counts[matchesNoDate[k].team2Id]} ${minCountValues}`);
                                matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                                break
                            }
                            // console.log(counts[matchesNoDate[k].team1Id])
                        }else if(counts[matchesNoDate[k].team1Id]){
                            if((counts[matchesNoDate[k].team1Id]> minCount)&&minCountValues>1){
                                console.log('next')
                            }else{
                                matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                                break
                            }
                        }else if(counts[matchesNoDate[k].team2Id]){
                            if((counts[matchesNoDate[k].team2Id]> minCount)&&minCountValues>1){
                                console.log('next')
                            }else{
                                matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                                break
                            }
                        }else{
                            console.log('leftover');
                            matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                            break
                        }
                        if(k===matchesNoDate.length-1){
                            matchesNoDate[0].startDate = new Date(gameDays[i].getTime())
                            break
                        }
                        console.log(`${league.leagueId} ${k} ${matchesNoDate.length}`);
                        // matchesNoDate[k].startDate = new Date(gameDays[i].getTime())
                        // break
                    }
                    // if(imatch<league.totalRegularSeasonGames){
                    //     // console.log(`${league.leagueId}: ${league.playoffs} ${league.scheduleMatches.length} ${imatch} ${numberOfMatches} ${j} R`)
                    //     league.scheduleMatches[imatch].startDate = new Date(gameDays[i].getTime())
                    // }else{
                    //     // console.log(`${league.leagueId}: ${league.playoffs} ${league.playoffMatches.length} ${imatch-league.totalRegularSeasonGames} ${numberOfMatches} ${j} P`)
                    //     league.playoffMatches[imatch-league.totalRegularSeasonGames].startDate = new Date(gameDays[i].getTime())
                    // }
                    imatch++
                }
                
            }

            // for(let i=0;i<league.scheduleMatches;i++){
            //     // need to account for playoffs as well
            //     let imatch = league.scheduleMatches(i)


            // }
            allGames = allGames.concat(league.scheduleMatches)
            allGames = allGames.concat(league.playoffMatches)
            // allRegularGames = allRegularGames.concat(league.scheduleMatches)
        }
        allGames.sort((a, b) => a.startDate - b.startDate)
        // console.log(allGameDays)
        // setting match times
        for(let i=0;i< allGameDays.length;i++){
            // console.log(`${i} ${allGameDays.length}`);
            let currentGameDay = allGameDays[i]
            // console.log(currentGameDay.getTime())
            // for(let igame of allGames){
            //     console.log(igame);
            // }
            // console.log(allGames[1]);
            let currentTimeFieldList = [...timeFieldList]
            let currentDayMatches = allGames.filter(obj => obj.startDate.getTime() === currentGameDay.getTime())
            // console.log(timeFieldList)
            let fieldNumber = 1
            let maxFieldNumber = 4
            let timeNumber = 0
            // let firstHour = 6+12
            for(let j=0;j< currentDayMatches.length;j++){
                // const counts = {};

                // // Iterate through the array of objects
                // currentDayMatches.forEach(obj => {
                //     // Extract the values from the specified properties
                //     const value1 = obj.team1Id;
                //     const value2 = obj.team2Id;

                //     // Increment the count for value1
                //     counts[value1] = (counts[value1] || 0) + 1;

                //     // Increment the count for value2
                //     counts[value2] = (counts[value2] || 0) + 1;
                // })
                // // Find the minimum count among the unique values
                // const minCount = Math.min(...Object.values(counts));

                // // Count how many items in counts equal the minimum value
                // const minCountValues = Object.values(counts).filter(count => count === minCount).length;
                // console.log(`${minCount} ${minCountValues}`)
                // console.log(minCountValues)
                for(let k=0;k<currentTimeFieldList.length;k++){
                    // console.log(array.reduce((minCount, obj) => {
                    //     // Count occurrences of the value in both properties
                    //     const count1 = obj.team1Id === value ? 1 : 0;
                    //     const count2 = obj.team2Id === value ? 1 : 0;
                        
                    //     // Update the minimum count
                    //     return Math.min(minCount, count1 + count2);
                    //   }, Infinity))
                    if(currentDayMatches.some(obj => 
                        (((obj.team1Id === currentDayMatches[j].team1Id || 
                            obj.team1Id === currentDayMatches[j].team2Id) 
                            && obj.team1Id !== 'TBD')
                            || ((obj.team2Id === currentDayMatches[j].team1Id || 
                            obj.team2Id === currentDayMatches[j].team2Id)
                            && obj.team2Id !== 'TBD')
                        )

                            && obj.startDate.getTime() === currentDayMatches[j].startDate.getTime()+currentTimeFieldList[k].timeMs
                        ))
                    {
                        // nothing
                    }else{
                        // console.log(`${currentDayMatches[j].team1Id} ${currentDayMatches[j].team2Id}`)
                        if((currentDayMatches[j].team1Id == 'CYD' && currentDayMatches[j].team2Id == 'SPY') || (currentDayMatches[j].team1Id == 'GKS'&& currentDayMatches[j].team2Id == 'FBS')){
                            console.log(currentTimeFieldList)
                            console.log(currentTimeFieldList[k])
                        }
                        currentDayMatches[j].startDate.setTime(currentDayMatches[j].startDate.getTime()+currentTimeFieldList[k].timeMs)
                        currentDayMatches[j].fieldNumber = currentTimeFieldList[k].fieldNumber
                        currentTimeFieldList.splice(k,1)
                        break;
                    }
                }
                
                currentDayMatches[j].startTime=currentDayMatches[j].startDate.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true}).replace(/\s/g, " ")
                // console.log(currentDayMatches[j].startTime)
                // currentDayMatches[j].fieldNumber = currentTimeFieldList[0].fieldNumber
                
                // console.log(`${currentDayMatches[j].startDate.toLocaleDateString()} ${currentDayMatches[j].startDate.toLocaleTimeString()} ${currentDayMatches[j].fieldNumber}`)
                



                // currentDayMatches[j].startDate.setTime(currentDayMatches[j].startDate.getTime()+((timeNumber)*1000*60*60)+firstGameTime)
                // currentDayMatches[j].startTime=currentDayMatches[j].startDate.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true}).replace(/\s/g, " ")
                // console.log(currentDayMatches[j].startTime)
                // currentDayMatches[j].fieldNumber = fieldNumber
                // console.log(`${currentDayMatches[j].startDate.toLocaleDateString()} ${currentDayMatches[j].startDate.toLocaleTimeString()} ${currentDayMatches[j].fieldNumber}`)
                // if(fieldNumber < maxFieldNumber){
                //     fieldNumber++
                    
                // }else{
                //     fieldNumber = 1
                //     timeNumber++
                // }
            }
        }
        // for(let i=0;i<allGames.length;i++){
        //     console.log(allGames[i])
        // }
        // console.log(allGameDays)
        // console.log(allGames)
        // console.log(allRegularGames.filter(obj=> obj.dayOfWeek===0).length)
        // return res.status(204).send()
            result = await request.query(`BEGIN TRY
            BEGIN TRANSACTION;
            DECLARE @GameValues TABLE (
                type VARCHAR(255),
                team1Id VARCHAR(255),
                team2Id VARCHAR(255),
                leagueId VARCHAR(255),
                subLeagueId VARCHAR(255),
                fieldId VARCHAR(255),
                startTime VARCHAR(255),
                startDate VARCHAR(255),
                startUnixTime bigint,
                location VARCHAR(255)
            );

            INSERT INTO @GameValues (type, team1Id,team2Id,leagueId,subLeagueId,fieldId,startTime,startDate,startUnixTime,location)
            VALUES ${allGames.map(obj => `('${obj.type}', '${obj.team1Id}', '${obj.team2Id}', '${obj.leagueId}', '${obj.subLeagueId}', '${obj.fieldNumber}', '${obj.startTime}', '${obj.startDate.toLocaleDateString('en-US')}', '${obj.startDate.getTime()}', 'Field ${obj.fieldNumber}')`).join(',')}
            DECLARE @ScheduleId INT
            -- Insert into schedules table to get the auto-generated ID
            INSERT INTO schedules (season,sport,name)
            VALUES ('${req.body.seasonId}','${req.body.sport}','${scheduleName}');

            -- Retrieve the generated ID
            SET @ScheduleId = SCOPE_IDENTITY();

            -- Insert into schedule_games using the generated ID for each row in @GameValues
            INSERT INTO schedule_games (ScheduleId, type, team1Id,team2Id,leagueId,subLeagueId,fieldId,startTime,startDate,startUnixTime,location)
            SELECT @ScheduleId, type, team1Id,team2Id,leagueId,subLeagueId,fieldId,startTime,startDate,startUnixTime,location
            FROM @GameValues;

            COMMIT TRANSACTION;
            SELECT @ScheduleId AS ScheduleId
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0
                ROLLBACK TRANSACTION;

            -- You can handle the error as needed, e.g., raise an error, log it, etc.
            THROW;
        END CATCH;`)
        console.log(result.recordset[0].ScheduleId)
        // console.log(result.recordset[0]['@ScheduleId']);
        res.redirect(`/schedules/item/${result.recordset[0].ScheduleId}`)
        // res.status(204).send()
            
            // res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/list'], async (req, res, next) => {
    try{
        const request = pool.request()
        const result = await request
        .query(`select * from schedules
        `)
        console.log(req.originalUrl)
        let data = {
            page: `${req.originalUrl}`,
            user: req.user,
            list: result.recordsets[0]
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post(['/list'], async (req, res, next) => {
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`select * from schedule_games
        // where scheduleId = '${req.scheduleId}'
        // `)
        // console.log(req.originalUrl)
        // let data = {
        //     page: `${req.originalUrl}`,
        //     user: req.user,
        //     list: result.recordsets[0]
        // }
        res.redirect(`/schedules/item/${req.body.scheduleId}`)
        // res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/test'], async (req,res)=>{
    // let data = {
    // // }
    const request = pool.request()
        // result = await request.query(`insert into schedules (season,sport,name)
        // values ('Indoor','Soccer', 'Indoor Soccer')`)
    //     data.teams = result.recordsets[0]
    //     // console.log(result.recordsets[0])
    //     for(let iteam of data.teams){
    //         result = await request.query(`exec conflictingTeams @teamId='${iteam.teamId}'`)
    //         iteam.conflictingTeams = result.recordsets[0].map(item => item.teamId)
    //         // console.log(iteam.conflictingTeams)
    //     }
    let sportName = 'Soccer'
    let leagueName = 'Indoor'
    let leagueList = scheduler.leagueSchedule(await getLeaguesForScheduler(sportName, leagueName),8)
    let allRegularGames = []
    for(let league of leagueList){
        allRegularGames = allRegularGames.concat(league.scheduleMatches)
        // console.log(league.scheduleMatches)
        // console.log(league.scheduleMatches.map(obj => `('${obj.type}', '${obj.team1Id}', '${obj.team2Id}', '${obj.leagueId}', '${obj.subLeagueId}')`).join(','))
    }
    console.log(allRegularGames)
    
        result = await request.query(`BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @GameValues TABLE (
            type VARCHAR(255),
            team1Id VARCHAR(255),
            team2Id VARCHAR(255),
            leagueId VARCHAR(255),
            subLeagueId VARCHAR(255)
        );

        INSERT INTO @GameValues (type, team1Id,team2Id,leagueId,subLeagueId)
        VALUES ${allRegularGames.map(obj => `('${obj.type}', '${obj.team1Id}', '${obj.team2Id}', '${obj.leagueId}', '${obj.subLeagueId}')`).join(',')}
        DECLARE @ScheduleId INT
        -- Insert into schedules table to get the auto-generated ID
        INSERT INTO schedules (season,sport,name)
        VALUES ('${leagueName}','${sportName}','${leagueName} ${sportName}');

        -- Retrieve the generated ID
        SET @ScheduleId = SCOPE_IDENTITY();

        -- Insert into schedule_games using the generated ID for each row in @GameValues
        INSERT INTO schedule_games (ScheduleId, type, team1Id,team2Id,leagueId,subLeagueId)
        SELECT @ScheduleId, type, team1Id,team2Id,leagueId,subLeagueId
        FROM @GameValues;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- You can handle the error as needed, e.g., raise an error, log it, etc.
        THROW;
    END CATCH;`)

    res.status(204).send()
})  
router.get(['/item/:scheduleId'], async (req, res, next) => {
    try{
        const request = pool.request()
        const result = await request
        .query(`select * from schedule_games
        where scheduleId = '${req.params.scheduleId}'
        select name from schedules
        where scheduleId = '${req.params.scheduleId}'
        `)
        console.log(req.originalUrl)
        let data = {
            page: `${req.originalUrl}`,
            user: req.user,
            list: result.recordsets[0],
            scheduleName: result.recordsets[1][0].name,
            scheduleId: req.params.scheduleId
        }
        // res.redirect(`/schedules/${req.body.scheduleId}`)
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})


router.get('/', async (req,res, next)=>{
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`DECLARE @league varchar(255)
        // Set @league = '${req.params.league}'
        // Execute ${req.params.type}Standings @league
        // `)
        let data = {
            page: `schedules`,
            user: req.user
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
});



function playableDays(startDate,endDate,dayOfWeek){
    // let totalDays = 1 + Math.round((d1-d0)/(24*3600*1000))
    let firstGameDate = new Date(startDate)
    let lastGameDate = new Date(endDate)
    let msInWeek = 1000*60*60*24*7
    let holidays = [new Date('May 24, 2024'),
        new Date('May 27, 2024'),
        new Date('July 4, 2024'),
        new Date('July 5, 2024'),
        new Date('July 8, 2024'),
        new Date('August 30, 2024'),
        new Date('September 2, 2024')
    ]
    let gameDays = []
    // set first game date
    if(dayOfWeek< firstGameDate.getDay()){
        firstGameDate.setDate(firstGameDate.getDate()+7-(firstGameDate.getDay()-dayOfWeek))
    }else{
        firstGameDate.setDate(firstGameDate.getDate()+(dayOfWeek-firstGameDate.getDay()))
    }
    // console.log(firstGameDate);
    // set last game date
    if(dayOfWeek> lastGameDate.getDay()){
        lastGameDate.setDate(lastGameDate.getDate()-7+(dayOfWeek-lastGameDate.getDay()))
    }else{
        lastGameDate.setDate(lastGameDate.getDate()-(lastGameDate.getDay()-dayOfWeek))
    }
    for(let i=0;i<((lastGameDate.getTime()-firstGameDate.getTime())/msInWeek)+1;i++){
        let newDate = new Date(firstGameDate.getTime()+(i*msInWeek))
        // newDate.setDate(firstGameDate.getTime()+(i*msInWeek))
        // console.log(firstGameDate.getDate()+(i*7))
        if(!holidays.some(function (holiday) {return holiday.getTime() === newDate.getTime()})){
            gameDays.push(newDate)
        }
    }
//     let holidaysDuringSeason = holidays.filter(date => 
//         {
//         let currentHoliday = new Date(date)
//         return currentHoliday.getDay() === dayOfWeek 
//         && currentHoliday >= firstGameDate 
//         && currentHoliday <= lastGameDate
//     }
// ).length
    return gameDays
    // return ((lastGameDate-firstGameDate)/msInWeek)+1 - holidaysDuringSeason
}
async function getTeamsForScheduler(xSport, xSeason){
    let teams = []
    const request = pool.request()
        result = await request.query(`exec teamListForScheduler @sport='${xSport}', @season='${xSeason}'`)
        teams = result.recordsets[0]
        for(let iteam of teams){
            result = await request.query(`exec conflictingTeams @teamId='${iteam.teamId}'`)
            iteam.conflictingTeams = result.recordsets[0].map(item => item.teamId)
            iteam.gamesPlayed = 0
        }
        return teams
}
async function getLeaguesForScheduler(xSport, xSeason){
    let teams = []
    let leagues = []
    let league = {}
    const request = pool.request()
        result = await request.query(`exec teamListForScheduler @sport='${xSport}', @season='${xSeason}'`)
        teams = result.recordsets[0]
        for(let iteam of teams){
            result = await request.query(`exec conflictingTeams @teamId='${iteam.teamId}'`)
            iteam.conflictingTeams = result.recordsets[0].map(item => item.teamId)
            iteam.gamesPlayed = 0
            if(leagues.length == 0){
                league = {
                    leagueId: iteam.league,
                    dayOfWeek: iteam.dayOfWeek,
                    teams: []
                }
                league.teams.push(iteam)
                leagues.push(league)
                // console.log(leagues)
            }else if(leagues.some(obj=>obj.leagueId===iteam.league)){
                league = leagues.find(obj=>obj.leagueId===iteam.league)
                league.teams.push(iteam)
            }else{
                league = {
                    leagueId: iteam.league,
                    dayOfWeek: iteam.dayOfWeek,
                    teams: []
                }
                league.teams.push(iteam)
                leagues.push(league)
            }
        }
        // for(let ileague of leagues){
        //     console.log(ileague)
        // }
        return leagues
}

// Export the router so it can be used in other files
module.exports = router;
