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
const Sequelize = require('sequelize');
const SessionStore = require('express-session-sequelize')(session.Store)
const methodOverride = require('method-override')
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const initializePassport = require('./passport-config')

const config = {
        server: process.env.DB_SERVER,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        trustServerCertificate: true,
        options: {
            encrypt: true,
            connectionTimeout: 30000,
            pool: {
              max: 10,
              min: 0,
              idleTimeoutMillis: 30000,
            },
          },
    };
const sequelize = new Sequelize({
    dialect: 'mssql',
    host: process.env.DB_SERVER,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: false,
    define: {
        timestamps: false,
    },
});
    const pool = new sql.ConnectionPool(config)
    pool.connect().then(() => {
        console.log('Connected to MSSQL with global connection pool');
      })
      .catch((err) => {
        console.error('Error connecting to MSSQL:', err);
      });

const Session = sequelize.define('Session', {
    sid: {
    type: Sequelize.STRING,
    primaryKey: true,
    },
    data: Sequelize.STRING,
    expires: Sequelize.DATE,
});
const sessionStore = new SessionStore({
    db: sequelize,
    table: 'Session',
});
initializePassport(
    passport, 
    email => users.find(user => user.email === email),
    id => users.find(user=> user.id === id),
    async email => {
        // try{
            // const pool = new sql.ConnectionPool(config)
            // await pool.connect();
            const request = pool.request()
            const result = await request
            .query(`select firstName, id, email, [password] 
            from users as t1
            LEFT JOIN emails as t2
            on t1.ID=t2.userID
            LEFT JOIN credentials as t3 
            on t1.ID=t3.userID
            where email = '${email}'`)
            return result
        // }catch(err){
        //     console.error('Error:', err)
        //     return err
        // }  
        },
    async id => {
        // try{
            // const pool = new sql.ConnectionPool(config)
            // await pool.connect();
            const request = pool.request()
            const result = await request
            .query(`select firstName, id, email
            from users as t1
            LEFT JOIN emails as t2
            on t1.ID=t2.userID
            where id = '${id}'`)
            return result
        // }catch(err){
        //     console.error('Error:', err)
        //     return err
        // }  
        }
    )
// const open = require('open')

const port = process.env.APP_PORT
let options = {}

app.use(express.urlencoded({ extended: true }))
app.use(express.static('public',options))
app.set('view-engine','ejs')
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
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
    id: '',
    score: 0,
    name: '',
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
    try{
        // console.log(req.user)
        res.redirect('/games')
    }catch(err){
        console.error('Error:', err)
    }    
    // res.render('smartphone.ejs') 
})
app.get(['/login'], checkNotAuthenticated, async (req,res)=>{
    try{
        res.render('login.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
app.post(['/login'], passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))
app.get(['/register'], async (req,res)=>{
    try{
        res.render('register.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})

app.post(['/register'], async (req,res)=>{
    // console.log(req.body);
    try {
        const hashedpassword = await bcrypt.hash(req.body.password, 10)
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        const result = await request
        .query(`
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
        res.redirect('/login')
    }catch(err){
        console.log(err)
        res.redirect('/register')
    }
    
    // console.log(users)
})
app.get(['/forgotPassword'], async (req,res)=>{
    try{
        res.render('forgotPassword.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
app.post(['/forgotPassword'], async (req,res)=>{
    const { email } = req.body;
    const request = pool.request();
  const userQuery = `select firstName, id, email, [password] 
                        from users as t1
                        LEFT JOIN emails as t2
                        on t1.ID=t2.userID
                        LEFT JOIN credentials as t3 
                        on t1.ID=t3.userID
                        where email = '${email}'`;

  try {
    const result = await request.query(userQuery);
    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate and save reset token
    const token = crypto.randomBytes(32).toString('hex');
    const resetTokenQuery = `
      INSERT INTO ResetTokens (userId, token) VALUES (${user.id}, '${token}')
    `;

    await request.query(resetTokenQuery);

    // Send reset email
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        service: 'gmail',
        secure: false,
        auth: {
           user: process.env.ORG_EMAIL,
           pass: process.env.ORG_EMAIL_PASSWORD
        },
        debug: false,
        logger: true
    });

    const resetLink = `https://glad-pika-totally.ngrok-free.app/reset/${token}`;
    const mailOptions = {
      from: process.env.ORG_EMAIL,
      to: user.email,
      subject: 'Password Reset',
      text: `Click the following link to reset your password: ${resetLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error('Error sending reset email:', error);
      }
      console.log('Reset email sent:', info.response);
      return res.redirect('/')
    //   return res.render('login.ejs', { messages: {message: 'Reset email sent Successfully'}})
    //   res.json({ message: 'Reset email sent' });
    });
  } catch (error) {
    console.error('Error finding user:', error);
  } 
})
app.get('/pswdreset', async (req, res, next) => {
    try{
        res.render('resetPassword.ejs') 
    }catch(err){
        console.error('Error:', err)
    }    
})
app.post('/pswdreset', async (req, res, next) => {
    try{
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            return res.render('resetPassword.ejs', { messages: {error: 'Passwords do not match'} })
            // return res.status(404).json({ message: 'Passwords do not match' });
        } 
    }catch(err){
        console.error('Error:', err)
    }    
})
app.get('/reset/:token', async (req, res, next) => {
    try{
        res.render('resetPassword.ejs')
    }catch(err){
        console.error('Error:', err)
    }
})
app.post('/reset/:token', async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('resetPassword.ejs', { messages: {error: 'Passwords do not match'} })
        }
        // Use MSSQL to find reset token in the database
        // const pool = await mssql.connect(config);
        const request = pool.request();
        const resetTokenQuery = `SELECT * FROM ResetTokens WHERE token = '${token}'`;
  
    
        const result = await request.query(resetTokenQuery);
        const resetToken = result.recordset[0];
    
        if (!resetToken) {
            return res.status(404).json({ message: 'Invalid token' });
        }
    
        // Update user password and remove reset token
        const userQuery = `SELECT * FROM Users WHERE id = ${resetToken.userId}`;
        const userResult = await request.query(userQuery);
        const user = userResult.recordset[0];
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const hashedpassword = await bcrypt.hash(password, 10)
        const updateUserQuery = `
            UPDATE credentials SET password = '${hashedpassword}' WHERE userID = ${user.ID}
        `;
    
        await request.query(updateUserQuery);
        const removeResetTokenQuery = `DELETE FROM ResetTokens WHERE token = '${token}'`;
        await request.query(removeResetTokenQuery);
        res.redirect('/')
        //   res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
    }
  });
app.post(['/paidChanges'], async (req,res,next)=>{
    // res.status(500);

    // Send a JSON response with the error message
    // res.json({ error: 'An error occurred while processing your request.' });
    try{
        const request = pool.request()
        if(Object.keys(req.body).length >0){
                    const result = await request
                    .query(`Update winners
                    Set paid =
                    Case 
                    when Event_ID in (${Object.keys(req.body).map(item => `'${item}'`).join(', ')}) then 'true'
                    else 'false'
                    End`)
        }else{
            const result = await request
                    .query(`Update winners
                    Set paid = 'false'`)
        }
        // if(req.body[0].length !== 0){
        //     console.log(req.body[0].keys())
        // }
        // res.status(500);

    // Send a JSON response with the error message
        // res.json({ error: 'An error occurred while processing your request.' });
        res.redirect('back')
    }catch(err){
        // return res.render('resetPassword.ejs', { messages: {error: 'Passwords do not match'} })
    }
})
app.get(['/timer'], async (req,res,next)=>{
    try{
        var game
        var newStartTime
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        if(req.query.gameStatus == 1){
            res.redirect('/readyforupload')
        }else if(req.query.timerState == 2){
            // const pool = new sql.ConnectionPool(config)
            // await pool.connect();
            const request = pool.request()
            const result = await request
            .query(`select * from winningTeam('${req.query.Event_ID}')`)
            if(result.recordset[0].length=1){
                await request
                .query(`insert into winners (TeamId, fullName, shortName, color, captain, player, email, phone, Event_ID, paid)
                select top 1 *, '${req.query.Event_ID}', 'false' as Event_ID 
                from winningTeamContact('${result.recordset[0].teamName}')
                where not 'MOI' in (Select league from teams
                    where id = '${result.recordset[0].teamName}')`)
            }  
            await request.query(`UPDATE [scorecard].[dbo].[games] set [Status] = 1 WHERE event_Id = '${req.query.Event_ID}'`)
            res.redirect('/games')
        } else {
            // const pool = new sql.ConnectionPool(config)
            // await pool.connect();
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
app.get(['/games'], checkAuthenticated, async (req,res,next)=>{
    try{
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        var data = {
            teams: [
                team1,
                team2
            ],
            page: req.route.path[0].replace('/','')
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01')) = CONVERT(date,'01-07-2024')
        const result = await request.query(`Select * from gamesList() order by startUnixTime`)
        data.games = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
})
app.get(['/readyForUpload'], async (req,res, next)=>{
    try{
        var data = {
            teams: [
                team1,
                team2
            ],
            page: req.route.path[0].replace('/','')
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        const result = await request.query(`SELECT * from dbo.gamesreadytoupload() select * from dbo.statsreadytoupload()`)
        data.games = result.recordsets[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
app.get(['/winners'], async (req,res, next)=>{
    try{
        var data = {
            page: req.route.path[0].replace('/','')
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        const result = await request.query(`SELECT * from dbo.winners
                                            LEFT join games on winners.Event_ID=games.Event_ID`)
        data.winners = result.recordsets[0]  
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
app.get(['/users'], async (req,res, next)=>{
    try{
        var data = {
            page: req.route.path[0].replace('/','')
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        const result = await request.query(`SELECT * from dbo.users`)
        data.users = result.recordsets[0]  
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
app.get(['/activeGame'], checkAuthenticated, async (req,res,next)=>{
    try {
        var game
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        let result = await request.query(`Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team1_ID}' and keeper in (Select id from [scorecard].[dbo].[players] where team ='${req.query.Team1_ID}')
        Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team2_ID}' and keeper in (Select id from [scorecard].[dbo].[players] where team ='${req.query.Team2_ID}')`)
        if(result.recordsets[0].length == 0){
            // var pool = await sql.connect(config)
            // pool.request()
            await request.query(`
            update teams
            set keeper = (Select top 1 id from [scorecard].[dbo].[players] where team ='${req.query.Team1_ID}')
            where id = '${req.query.Team1_ID}'
            `)
        }
        if(result.recordsets[1].length == 0){
            // var pool = await sql.connect(config)
            // pool.request()
            await request.query(`
            update teams
            set keeper = (Select top 1 id from [scorecard].[dbo].[players] where team ='${req.query.Team2_ID}')
            where id = '${req.query.Team2_ID}'
            `)
        }
        result = await request.query(`EXEC [scorecard].[dbo].[getActiveGameData] @eventId ='${req.query.Event_ID}'`)
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
    } catch(err){
        next(err)
    }
})

// app.post(['/'], async (req,res)=>{
//     // res.render('index.ejs')
//     res.render('smartphone.ejs') 
// })
app.post(['/eventLog'], async (req,res,next)=>{
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
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
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
            result = await request.query(`insert into scorecard.dbo.eventLog (playerId, teamName, realTime, periodTime, period, value, type, Event_ID, opponentKeeper, season, subseason) VALUES('${req.body.playerId}','${req.body.teamName}','${req.body.realTime}','${req.body.periodTime}','${req.body.period}','${req.body.value}','${req.body.type}','${req.body.Event_ID}','${req.body.opponentKeeper}','${req.body.season}','${req.body.subseason}')`)
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
            where Id = '${req.body.playerId}'

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
        next(err)
    }
})
app.post(['/addPlayer'], async (req,res,next)=>{
    try{
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        await request.query(`insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName, playerType) VALUES('${req.body.team}','${req.body.firstName} ${req.body.lastName}','${req.body.firstName}${req.body.lastName}','${req.body.firstName}','${req.body.lastName}','${req.body.playerType}')`)
        res.redirect('back')
    }catch(err){
        next(err)
    }
})
app.post('/switchSides', async (req, res, next) => {
    // Process form data here
    try{
        const formData = req.body;
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        await request.query(`EXEC [scorecard].[dbo].[switchSides] @eventId ='${req.body.Event_ID}'`)
        res.json({ message: 'Form submitted successfully!', data: formData });
    }catch(err){
        next(err)
    }
  });

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

  app.post('/testEventLog', async (req, res, next) => {
    // Process form data here
    const formData = req.body;
    // console.log(formData)
    // await sql.connect(config).then(pool => {
    //     // Query

    //     return pool.request().query(`EXEC [scorecard].[dbo].[switchSides] @eventId ='${req.body.Event_ID}'`)
    // }).then(result => {
        
    // }).catch(err => {
    //     next(err)
    // // ... error checks
    // });  
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
    try{
        req.logOut((err)=> {
            if(err){return next(err)}
            res.redirect('/login')
        })
    }catch(err){
        console.error('Error:', err)
    }    
})

function checkAuthenticated(req, res, next) {
    try{
        if (req.isAuthenticated()) {
            return next()
        }
        res.redirect('/login')
    }catch(err){
        console.error('Error:', err)
    }    
}

function checkNotAuthenticated(req, res, next) {
    try{
        if (req.isAuthenticated()) {
            return res.redirect('/')
        }
        next()
    }catch(err){
        console.error('Error:', err)
    }    
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
