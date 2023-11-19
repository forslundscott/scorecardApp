const express = require("express")
const app = express()
const port = 3000
let options = {}

app.use(express.urlencoded({ extended: true }))
app.use(express.static('public',options))
app.set('view-engine','ejs')
var eventLog = [

]
// Helpers and Routes
const functions = require('./helpers/functions')
// const forms = require('./routes/forms')
// app.use('/forms',forms)
app.locals.functions = functions

const sql = require('mssql');
    const config = {
        server: 'scott-HP-Z420-Workstation',
        database: 'scorecard',
        user: 'SRF',
        password: 'Planbsk8!!8ksbnalP',
        trustServerCertificate: true,
    };

// var connection = functions.getAccess()
var gameInfo = {
    period: 1,
    time: '',
    clockState: 'Start'
}

var team1 = {
    id: "",
    score: 0,
    name: "",
    keeper: '',
    players: []
}

var team2 = {
    id: '',
    score: 0,
    name: '',
    keeper: '',
    players: []
}
var games = []

app.get(['/'], async (req,res)=>{
    // res.render('index.ejs')
    res.redirect('/games')
    // res.render('smartphone.ejs') 
})
app.get(['/timer'], async (req,res)=>{
    var game
    var newStartTime
    if(req.query.timerState == 2){
        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                .query(`UPDATE [scorecard].[dbo].[games] set [Status] = 1 WHERE event_Id = ${req.query.Event_ID}`)
        }).then(result => {
            // games = result.recordset
        }).catch(err => {
            console.log(err)
        // ... error checks
        });  
        res.redirect('/games')
    } else {
        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                .query(`SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = ${req.query.Event_ID}`)
        }).then(result => {
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

        }).catch(err => {
            console.log(err)
        // ... error checks
        });  

        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                .query(`UPDATE [scorecard].[dbo].[games] set [timerTime] = ${game.timerTime}, [timerStartTime] = ${game.timerStartTime}, [timerState] = ${game.timerState} WHERE event_Id = ${req.query.Event_ID}`)
        }).then(result => {
            // games = result.recordset
        }).catch(err => {
            console.log(err)
        // ... error checks
        });  
        console.log((Number("15:00".split(':')[0])*60+Number("15:00".split(':')[1]))*1000)
        res.sendStatus(204)
    }
})
app.get(['/games'], async (req,res)=>{
    // res.render('index.ejs')
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT * FROM [scorecard].[dbo].[games] where [Status]=0`)
    }).then(result => {
        games = result.recordset
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  

    var data = {
        teams: [
            team1,
            team2
        ],
        games: games,
        page: req.route.path[0].replace('/','')
    }
    res.render('index.ejs',{data: data}) 
})
app.get(['/activeGame'], async (req,res)=>{
    var game
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`EXEC [scorecard].[dbo].[rosterGameStats] @teamName ='${req.query.Team1_ID}'`)
    }).then(result => {
        team1.id = req.query.Team1_ID
        team1.players = result.recordset
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`EXEC [scorecard].[dbo].[rosterGameStats] @teamName ='${req.query.Team2_ID}'`)
    }).then(result => {
        team2.id = req.query.Team2_ID
        team2.players = result.recordset
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT SUM(value) as score FROM [scorecard].[dbo].[eventLog] WHERE event_Id = ${req.query.Event_ID} and ((teamName = '${req.query.Team2_ID}' and type = 'owngoal') or (teamName = '${req.query.Team1_ID}' and type = 'goal')) GROUP BY event_id`)
    }).then(result => {
        if(result.recordset.length == 0){
            team1.score = 0
        }else{
            team1.score = result.recordset[0].score
        }
        // console.log(result.recordset.length)
        
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT SUM(value) as score FROM [scorecard].[dbo].[eventLog] WHERE event_Id = ${req.query.Event_ID} and ((teamName = '${req.query.Team1_ID}' and type = 'owngoal') or (teamName = '${req.query.Team2_ID}' and type = 'goal')) GROUP BY event_id`)
    }).then(result => {
        if(result.recordset.length == 0){
            team2.score = 0
        }else{
            team2.score = result.recordset[0].score
        }
        // team2.score = result.recordset[0].score
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = ${req.query.Event_ID}`)
    }).then(result => {
        
            game = result.recordset[0]

        // team2.score = result.recordset[0].score
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    if(game.timerState == 1 && (game.timerTime-(Date.now() - game.timerStartTime)) <= 0){
        if(game.period<game.maxPeriods){
            game.period=game.period +1
            game.timerState =0
            game.timerTime = game.timePerPeriod
        } else{
            game.timerState = 2
            game.timerTime = 0
        }
        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                .query(`UPDATE [scorecard].[dbo].[games] set [timerTime] = ${game.timerTime}, [period] = ${game.period}, [timerState] = ${game.timerState} WHERE event_Id = ${req.query.Event_ID}`)
        }).then(result => {
            // games = result.recordset
        }).catch(err => {
            console.log(err)
        // ... error checks
        });  
    }
    var data = {
        teams: [
            team1,
            team2
        ],
        game: game,
        page: req.route.path[0].replace('/',''),
        Event_ID: req.query.Event_ID
    }
    res.render('index.ejs',{data: data}) 
})

app.post(['/'], async (req,res)=>{
    // res.render('index.ejs')
    res.render('smartphone.ejs') 
})
app.post(['/eventLog'], async (req,res)=>{
    eventLog.push(req.body)
    // const sql = require('mssql');
    // const config = {
    //     server: 'scott-HP-Z420-Workstation',
    //     database: 'scorecard',
    //     user: 'SRF',
    //     password: 'Planbsk8!!8ksbnalP',
    //     trustServerCertificate: true,
    // };
    
    await sql.connect(config).then(pool => {
        // Query

        return pool.request().query(`insert into scorecard.dbo.eventLog (playerId, teamName, realTime, periodTime, period, value, type, Event_ID) VALUES('${req.body.playerId}','${req.body.teamName}','${req.body.realTime}','${req.body.periodTime}','${req.body.period}','${req.body.value}','${req.body.type}','${req.body.Event_ID}')`)
    }).then(result => {
        team1.id = req.query.Team1_ID
        team1.players = result.recordset
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    res.redirect('back')
    // res.sendStatus(204)
})
app.post(['/addPlayer'], async (req,res)=>{
    // const sql = require('mssql');
    // const config = {
    //     server: 'scott-HP-Z420-Workstation',
    //     database: 'scorecard',
    //     user: 'SRF',
    //     password: 'Planbsk8!!8ksbnalP',
    //     trustServerCertificate: true,
    // };
    'insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName) VALUES()'
    await sql.connect(config).then(pool => {
        // Query
        return pool.request().query(`insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName) VALUES('${req.body.team}','${req.body.firstName} ${req.body.lastName}','${req.body.firstName}${req.body.lastName}','${req.body.firstName}','${req.body.lastName}')`)
    }).then(result => {
        team1.id = req.query.Team1_ID
        team1.players = result.recordset
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    res.redirect('back')
})

// var x = setInterval(function() {
//     ;
//     // Get today's date and time
//     // var now = new Date().getTime();
      
//     // Find the distance between now and the count down date
//     if(document.getElementById('timerButton').innerText == 'Stop'){
//         distance = distance - 1000;
        
//         // Time calculations for days, hours, minutes and seconds
//         var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
//         var seconds = Math.floor((distance % (1000 * 60)) / 1000).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
        
//         // Output the result in an element with id="demo"
//         document.getElementById("gameTimer").innerHTML = minutes + ":" + seconds;
        
//         // If the count down is over, write some text 
//         if (distance < 0) {
//             clearInterval(x);
//             gameInfo.period = gameInfo.period + 1
//             // gameInfo.time = '15:00'
            
//         document.getElementById("gameTimer").innerHTML = "15:00";
//         document.getElementById('timerButton').innerHTML = 'Start'
//         location.reload()
//         // document.getElementById('timerButton').innerText = 'Start'
//         }
//     }
//   }, 1000);

app.listen(port, function(err){
    // if (err) console.log(err);
 })
