if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require("express")
const app = express()
// const bodyParser = require('body-parser')
const sql = require('mssql');
const bcrypt = require('bcrypt')
const puppeteer = require('puppeteer')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const initializePassport = require('./passport-config')

const config = {
        server: process.env.DB_SERVER,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        trustServerCertificate: true,
    };

initializePassport(
    passport, 
    email => users.find(user => user.email === email),
    id => users.find(user=> user.id === id),
    async email => {
        const pool = await sql.connect(config)
        const result = await pool.request()
        .query(`select firstName, id, email, [password] 
        from users as t1
        LEFT JOIN emails as t2
        on t1.ID=t2.userID
        LEFT JOIN credentials as t3 
        on t1.ID=t3.userID
        where email = '${email}'`)
        return result
        },
    async id => {
        const pool = await sql.connect(config)
        const result = await pool.request()
        .query(`select firstName, id, email
        from users as t1
        LEFT JOIN emails as t2
        on t1.ID=t2.userID
        where id = '${id}'`)
        return result
        }
    )
// const open = require('open')
const port = 3000
let options = {}

app.use(express.urlencoded({ extended: true }))
app.use(express.static('public',options))
app.set('view-engine','ejs')
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))


// Helpers and Routes
const functions = require('./helpers/functions');
// const { next } = require('cheerio/lib/api/traversing');
// const forms = require('./routes/forms')
// app.use('/forms',forms)
app.locals.functions = functions

// var connection = functions.getAccess()

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


app.get(['/'], checkAuthenticated, async (req,res)=>{
    // res.render('index.ejs')
    res.redirect('/games')
    // res.render('smartphone.ejs') 
})
app.get(['/login'], checkNotAuthenticated, async (req,res)=>{
    res.render('login.ejs')
})
app.post(['/login'], passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))
app.get(['/register'], async (req,res)=>{
    res.render('register.ejs')
})
app.post(['/register'], async (req,res)=>{
    // console.log(req.body);
    try {
        const hashedpassword = await bcrypt.hash(req.body.password, 10)
        await sql.connect(config).then(pool => {
            // Query

            return pool.request().query(`
            DECLARE @tempTable table (
                id int
            )
            
            insert into users (firstName, lastName)
            OUTPUT inserted.id
            into @tempTable
            values ('${req.body.firstName}', '${req.body.lastName}')
            
            insert into emails (userID,email)
            select id, '${req.body.email}' from @tempTable
            
            insert into credentials (userID,[password])
            select id, '${hashedpassword}' from @tempTable`)
        }).then(result => {
            
        }).catch(err => {
            console.log(err)
        // ... error checks
        }); 
        
        res.redirect('/login')
    }catch{
        res.redirect('/register')
    }
    
    console.log(users)
})
app.get(['/timer'], async (req,res,next)=>{
    var game
    var newStartTime
    if(req.query.gameStatus == 1){
        res.redirect('/readyforupload')
    }else if(req.query.timerState == 2){
        await sql.connect(config).then(async pool => {
            // Query
            return pool.request()
                .query(`select * from winningTeam(${req.query.Event_ID})`)
        }).then(async result => {
            // console.log(result.rowsAffected)
            if(result.recordset[0].length=1){
                var pool = await sql.connect(config)
                return pool.request()
                .query(`insert into winners (TeamId, fullName, shortName, color, captain, player, email, phone, Event_ID)
                select top 1 *, ${req.query.Event_ID} as Event_ID 
                from winningTeamContact('${result.recordset[0].teamName}')
                where not 'MOI' in (Select league from teams
                    where id = '${result.recordset[0].teamName}')`)
            }  
        }).then(async result => {
                var pool = await sql.connect(config)
                return pool.request()
                .query(`UPDATE [scorecard].[dbo].[games] set [Status] = 1 WHERE event_Id = ${req.query.Event_ID}`)
            
        }).catch(err => {
            next(err)
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
            next(err)
        // ... error checks
        });  

        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                .query(`UPDATE [scorecard].[dbo].[games] set [timerTime] = ${game.timerTime}, [timerStartTime] = ${game.timerStartTime}, [timerState] = ${game.timerState} WHERE event_Id = ${req.query.Event_ID}`)
        }).then(result => {
            // games = result.recordset
        }).catch(err => {
            next(err)
        // ... error checks
        });  
        console.log((Number("15:00".split(':')[0])*60+Number("15:00".split(':')[1]))*1000)
        res.redirect('back')
    }
})
app.get(['/games'], async (req,res,next)=>{
    // res.render('index.ejs')
    if (req.isAuthenticated()) {
        console.log(req.user)
    }
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            // .query(`SELECT * FROM [scorecard].[dbo].[games] where [Status]=0`)
            // `SELECT t1.*, t2.color as Team1Color, t3.color as Team2Color FROM [scorecard].[dbo].[games] t1 left join teams as t2 on t1.Team1_ID=t2.id left join teams as t3 on t1.Team2_ID=t3.id where t1.[Status]=0 and convert(date,DATEADD(s, startunixtime/1000, '1970-01-01')) = CONVERT(date,'12-10-2023')`
            // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01')) = CONVERT(date,'01-07-2024')
            .query(`Select * from gamesList()`)
    }).then(result => {
        games = result.recordset
    }).catch(err => {
        next(err)
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
app.get(['/readyForUpload'], async (req,res, next)=>{
    // res.render('index.ejs')
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            // .query(`SELECT * FROM [scorecard].[dbo].[games] where [Status]=0`)
            // `SELECT t1.*, t2.color as Team1Color, t3.color as Team2Color FROM [scorecard].[dbo].[games] t1 left join teams as t2 on t1.Team1_ID=t2.id left join teams as t3 on t1.Team2_ID=t3.id where t1.[Status]=0 and convert(date,DATEADD(s, startunixtime/1000, '1970-01-01')) = CONVERT(date,'12-10-2023')`
            .query(`SELECT * from dbo.gamesreadytoupload() select * from dbo.statsreadytoupload()`)
    }).then(result => {
        console.log(result.recordsets.length)
        games = result.recordsets[0]
        for(var i=0;i<result.recordsets[0].length;i++){
            var currentGameItem = result.recordsets[0][i]
            currentGameItem.players = []
            for(var j = result.recordsets[1].length -1;j>=0;j--){
                var currentPlayerItem = result.recordsets[1][j]
                if(currentPlayerItem.event_ID == currentGameItem.Event_ID){
                    currentGameItem.players.push(currentPlayerItem)
                    result.recordsets[1].splice(j,1)
                    // console.log(result.recordsets[1].length)
                }
            }
            // console.log(currentGameItem.players)
        }
        
    }).catch(err => {
        next(err)
    // ... error checks
    });  
// console.log(games)
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
app.get(['/winners'], async (req,res, next)=>{
    // res.render('index.ejs')
    var data = {
        page: req.route.path[0].replace('/','')
    }
    await sql.connect(config).then(pool => {
        // Query
        return pool.request()
            // .query(`SELECT * FROM [scorecard].[dbo].[games] where [Status]=0`)
            // `SELECT t1.*, t2.color as Team1Color, t3.color as Team2Color FROM [scorecard].[dbo].[games] t1 left join teams as t2 on t1.Team1_ID=t2.id left join teams as t3 on t1.Team2_ID=t3.id where t1.[Status]=0 and convert(date,DATEADD(s, startunixtime/1000, '1970-01-01')) = CONVERT(date,'12-10-2023')`
            .query(`SELECT * from dbo.winners`)
    }).then(result => {
        // console.log(result.recordsets.length)
        data.winners = result.recordsets[0]
        
        
    }).catch(err => {
        next(err)
    // ... error checks
    });  
// console.log(games)
    
    res.render('index.ejs',{data: data}) 
})
app.get(['/activeGame'], async (req,res,next)=>{
    try {
        var game
        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                // .query(`EXEC [scorecard].[dbo].[getActiveGameData] @eventId ='${req.query.Event_ID}'`)
                .query(`Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team1_ID}' and keeper in (Select id from [scorecard].[dbo].[players] where team ='${req.query.Team1_ID}')
                Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team2_ID}' and keeper in (Select id from [scorecard].[dbo].[players] where team ='${req.query.Team2_ID}')`)
        }).then(async result => {
            // console.log(result.recordset[0])
            console.log(result.recordsets[0][0])
            console.log(result.recordsets[1][0])
            if(result.recordsets[0].length == 0){
                var pool = await sql.connect(config)
                pool.request()
                .query(`
                update teams
                set keeper = (Select top 1 id from [scorecard].[dbo].[players] where team ='${req.query.Team1_ID}')
                where id = '${req.query.Team1_ID}'
                `)
            }
            if(result.recordsets[1].length == 0){
                var pool = await sql.connect(config)
                pool.request()
                .query(`
                update teams
                set keeper = (Select top 1 id from [scorecard].[dbo].[players] where team ='${req.query.Team2_ID}')
                where id = '${req.query.Team2_ID}'
                `)
            }
            // console.log(result.recordsets[2])
            // console.log(result.recordsets[3])
        }).catch(err => {
            next(err)
            console.log(err)
        // ... error checks
        });  
        await sql.connect(config).then(pool => {
            // Query
            return pool.request()
                .query(`EXEC [scorecard].[dbo].[getActiveGameData] @eventId ='${req.query.Event_ID}'`)
                // .query(`Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team1_ID}'
                // Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team2_ID}'
                // EXEC [scorecard].[dbo].[rosterGameStats] @teamName ='${req.query.Team1_ID}', @eventId ='${req.query.Event_ID}'
                // EXEC [scorecard].[dbo].[rosterGameStats] @teamName ='${req.query.Team2_ID}', @eventId ='${req.query.Event_ID}'
                // SELECT SUM(value) as score FROM [scorecard].[dbo].[eventLog] WHERE event_Id = ${req.query.Event_ID} and ((teamName = '${req.query.Team2_ID}' and type = 'owngoal') or (teamName = '${req.query.Team1_ID}' and type = 'goal')) GROUP BY event_id
                // SELECT SUM(value) as score FROM [scorecard].[dbo].[eventLog] WHERE event_Id = ${req.query.Event_ID} and ((teamName = '${req.query.Team1_ID}' and type = 'owngoal') or (teamName = '${req.query.Team2_ID}' and type = 'goal')) GROUP BY event_id
                // SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = ${req.query.Event_ID}`)
        }).then(result => {
            // console.log(result.recordset[0])
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
        }).catch(err => {
            next(err)
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
                next(err)
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
        // console.log(data.teams[0].players)
        res.render('index.ejs',{data: data}) 
    } catch(err){
        next(err)
    }
})

app.post(['/'], async (req,res)=>{
    // res.render('index.ejs')
    res.render('smartphone.ejs') 
})
app.post(['/eventLog'], async (req,res,next)=>{
    
    console.log(req.body)
    if(req.body.type == 'makecaptain'){
        await sql.connect(config).then(pool => {
            // Query
    
            return pool.request().query(`update scorecard.dbo.teams set captain = '${req.body.playerId}' where id = '${req.body.teamName}'`)
        }).then(result => {
            
        }).catch(err => {
            next(err)
        // ... error checks
        });  
        // res.redirect('back')
    }else if(req.body.type == 'makekeeper'){
        await sql.connect(config).then(pool => {
            // Query
    
            return pool.request().query(`update scorecard.dbo.teams set keeper = '${req.body.playerId}' where id = '${req.body.teamName}'`)
        }).then(result => {
            
        }).catch(err => {
            next(err)
        // ... error checks
        });  
        // res.redirect('back')
        
    }else{
        await sql.connect(config).then(pool => {
            // Query

            return pool.request().query(`insert into scorecard.dbo.eventLog (playerId, teamName, realTime, periodTime, period, value, type, Event_ID, opponentKeeper, season, subseason) VALUES('${req.body.playerId}','${req.body.teamName}','${req.body.realTime}','${req.body.periodTime}','${req.body.period}','${req.body.value}','${req.body.type}','${req.body.Event_ID}','${req.body.opponentKeeper}','${req.body.season}','${req.body.subseason}')`)
        }).then(result => {
            
        }).catch(err => {
            next(err)
        // ... error checks
        }); 
    }
    res.redirect('back')
    // res.sendStatus(204)
})
app.post(['/addPlayer'], async (req,res,next)=>{
    
    // 'insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName) VALUES()'
    console.log(req.body)
    await sql.connect(config).then(pool => {
        // Query
        return pool.request().query(`insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName, playerType) VALUES('${req.body.team}','${req.body.firstName} ${req.body.lastName}','${req.body.firstName}${req.body.lastName}','${req.body.firstName}','${req.body.lastName}','${req.body.playerType}')`)
    }).then(result => {
        // team1.id = req.query.Team1_ID
        // team1.players = result.recordset
    }).catch(err => {
        next(err)
    // ... error checks
    });  
    res.redirect('back')
})


app.post(['/uploadGames'], async (req,res)=>{
    // for upload
    // open glos site
    window.location.href = 'https://www.glosoccer.com/'
    document.getElementsByClassName('theme-nav-dropdown dropdown-align-left')[0].getElementsByTagName('a')[0].click() 
    document.getElementById('tool-game-schedule').getElementsByTagName('a')[0].click()
    document.getElementById('slider_day_2023_12_17').getElementsByTagName('a')[0].click()
    // game list headers
    // document.getElementsByTagName('thead')[0]
    // header items
    // document.getElementsByTagName('thead')[0].getElementsByTagName('th')
    // loop through header items to find status column
    for(var i=0;i<document.getElementsByTagName('thead')[0].getElementsByTagName('th').length;i++){
        if(document.getElementsByTagName('thead')[0].getElementsByTagName('th')[i].innerText == 'Status'){
            // collection of game list rows 
            var pageList = []
            for(var j=0;j<document.getElementsByTagName('tbody')[0].getElementsByTagName('tr').length;j++){
                pageList.push(document.getElementsByTagName('tbody')[0].getElementsByTagName('tr')[0].getElementsByTagName('td')[i].getElementsByTagName('a')[0].href)
            }
            break
        }
    }
    await open(pageList[0])
})
app.post('/switchSides', async (req, res, next) => {
    // Process form data here
    const formData = req.body;
    console.log(formData)
    await sql.connect(config).then(pool => {
        // Query

        return pool.request().query(`EXEC [scorecard].[dbo].[switchSides] @eventId ='${req.body.Event_ID}'`)
    }).then(result => {
        
    }).catch(err => {
        next(err)
    // ... error checks
    });  
    // Send a response back to the client
    res.json({ message: 'Form submitted successfully!', data: formData });
  });
// from mass
// document.getElementsByClassName('js-league leagueSelect')[0]


// // game list body
// document.getElementsByTagName('tbody')[0]
// // checks current league selected
// document.getElementsByClassName('js-league leagueSelect')[0].querySelectorAll(`option[value='${document.getElementsByClassName('js-league leagueSelect')[0].value}']`)[0].text 
app.get(['/test'], async (req,res)=>{
    (async () => {
        const browser = await puppeteer.launch({headless: false})
        const page = await browser.newPage()
        await page.goto('https://www.glosoccer.com')
        // nb-sign-in-link
        await page.goto(
            await page.evaluate(() => {
                return document.getElementById('nb-sign-in-link').href
            })
        )
        await page.evaluate(() => {
            
            document.getElementById('user_login').value = 'forslund.scott@gmail.com'
            document.getElementById('user_login').form.submit()
            return true
        })
        await page.waitForNavigation()
        await page.evaluate(() => {
            
            document.getElementById('user_password').value = 'Planbsk8!'
            document.getElementById('user_password').form.submit()
            return true
        })
        // continuebutton.value = 'forslund.scott@gmail.com'
        // continuebutton.form.submit
    })()
    res.status(204).send()
})
// // // selected league text
// document.getElementsByClassName('js-league leagueSelect')[0].selectedOptions[0].text 
// // // selected season text
// document.getElementsByClassName('js-season seasonSelect')[0].selectedOptions[0].text 
// // // set to all teams
// document.getElementsByClassName('js-team teamSelect')[0].value = ''
// // // refresh button
// document.getElementsByClassName('js-refreshTool saveChanges')[0]
// // mass page
// // game list
// var gameList = document.getElementsByClassName('MssEdItem Game clr')
// for(var igame=0;igame<gameList.length;igame++){


// // game item
// var gameList = document.getElementsByClassName('MssEdItem Game clr')
// for(var igame=0;igame<gameList.length;igame++){


// // game item
//     var gameItem = gameList[igame]
//     if(gameItem.getElementsByClassName('js-gameStatus')[0].value !== 'completed'){
//         var dateTimeBox = gameItem.getElementsByClassName('date_time')[0]
//         var startDate = dateTimeBox.getElementsByClassName('dateTimeDate')[0].value
//         var startTime = dateTimeBox.getElementsByClassName('dateTimeTime')[0].value 
//         var t1 = gameItem.getElementsByClassName('teams')[0].getElementsByClassName('team1')[0].innerText 
//         var t2 = gameItem.getElementsByClassName('teams')[0].getElementsByClassName('team2')[0].innerText 
//         // Edit Stats button
//         var statButton = gameItem.getElementsByClassName('game_stats')[0]
//         // check stats is selected
//         if(!statButton.classList.contains('selected')){
//             statButton.click()
//         }
//         // game stats section
//         var gameStatsSection = gameItem.getElementsByClassName('js-gameStats')[0]
//         // team tabs
//         var teamTabs = gameStatsSection.getElementsByClassName('js-tabs')[0].children
//         for(var i=0;i<teamTabs.length;i++){
//             var currentTeam = teamTabs[i]
//             if(currentTeam.innerText !== 'Scoring'){
				
//                     currentTeam.click()
// 					setTimeout(function() { }, 3600)
// 					console.log(gameStatsSection.getElementsByClassName('js-tabContent tabContent')[0].children[i].innerHTML)
//                     var playerTypeTabs = gameStatsSection.getElementsByClassName('js-tabContent tabContent')[0].children[i].getElementsByClassName('js-team uiTabs subTabs')[0].getElementsByTagName('li')
//                     for(var j=1;j<playerTypeTabs.length;j++){
//                         var currentPlayerType = playerTypeTabs[j]
//                             currentPlayerType.click()
//             //                 console.log(currentPlayerType.getElementsByTagName('caption')[0].innerText)
//                     }
                
//             }
//         }
//     }
// }                                                       

app.delete('/logout', (req,res) => {
    req.logOut((err)=> {
        if(err){return next(err)}
        res.redirect('/login')
    })
    
})

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }

    next()
}
app.use((err, req, res, next) => {
    console.error(err);
    // console.log(req)

    // Respond with an appropriate error message
    res.status(500).send('Internal Server Error');
});
app.listen(port, function(err){
    // if (err) console.log(err);
 })
