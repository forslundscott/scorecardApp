if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require("express")
const app = express()
// const mailchimp = {
//     marketing: require('@mailchimp/mailchimp_marketing'),
//     transactional: require('@mailchimp/mailchimp_transactional')(process.env.MANDRILL_KEY)
//     }
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
const mailchimp = require('./helpers/mailChimp')
// mailchimp.marketing.setConfig({
//     apiKey: process.env.MAILCHIMP_KEY,
//     server: process.env.MAILCHIMP_SERVER, // e.g., us1
// })

const ROLES = {}
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
    pool.connect().then(async () => {
        console.log('Connected to MSSQL with global connection pool');
        try{
            await roleSetter()
            console.log(ROLES.admin)
        }catch(err){
            console.error('Error:', err)
        }
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
    async email => {
            const request = pool.request()
            const result = await request
            .query(`select t1.firstName, t1.id, t1.email, t2.password 
            from users as t1
            LEFT JOIN credentials as t2 
            on t1.ID=t2.userID
            where t1.email = '${email}'`)
            return result
        },
    async id => {
            const request = pool.request()
            const result = await request
            .query(`select firstName, id, email
            from users
            where id = '${id}'`)
            return result
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
// sequelize.sync()

// Helpers and Routes
const functions = require('./helpers/functions');
const { log } = require('console');
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

async function roleSetter() {
    try{
        const request = pool.request();
        const result = await request.query(`
        SELECT name, id
        FROM roles
        `);
        result.recordset.forEach(row => {
            ROLES[row.name] = row.id;
        });
    }catch(err){
        console.error('Error:', err)
    }  
};



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
        console.log(req.session.cookie.returnTo)
        if (req.query.returnTo != undefined) {
            // console.log('query');
            req.session.returnTo = req.query.returnTo;
        }else{
            // console.log('header');
            req.session.returnTo = req.header('Referer')
            // console.log(req.session.cookie.returnTo)
            // console.log(req.session.returnTo)
        }
        await sequelize.sync({force: true})
        res.render('login.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
app.post(['/login'], 
function(req, res, next) { passport.authenticate('local', function(err, user, info, status) {
    if (err) { return next(err) }
    try{
        console.log(info)
        if (!user) { return res.render('login.ejs', {messages: info}) }
        req.session.passport = {}
        req.session.passport.user = user.id
        const redirectUrl = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectUrl);
    }catch(err){
        console.error('Error:', err)
    }
})(req, res, next)
})

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
        const emailExistsResult = await pool.request()
            // .input('email', sql.VarChar, req.body.email)
            .query(`SELECT COUNT(*) AS count FROM users WHERE email = '${req.body.email}'`);
        
        // If email already exists, respond with a message
        console.log(emailExistsResult.recordset[0].count)
        if (emailExistsResult.recordset[0].count > 0) {
            return res.render('register.ejs', {messages: {message: 'User with specified email already exists, Please use reset Password link.'}})
            // return res.status(400).send('User with specified email already exists');
        }
        const hashedpassword = await bcrypt.hash(req.body.password, 10)
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        const result = await request
        .query(`
            DECLARE @tempTable table (
                id int
            )
            BEGIN TRANSACTION
            insert into users (firstName, lastName, email)
            OUTPUT inserted.id
            into @tempTable
            values ('${req.body.firstName}', '${req.body.lastName}', '${req.body.email}')
            
            insert into credentials (userID,[password])
            select id, '${hashedpassword}' from @tempTable
            COMMIT`)        
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
                        LEFT JOIN credentials as t2 
                        on t1.ID=t2.userID
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
        const passwordExistsResult = await pool.request()
        // .input('userID', sql.VarChar, user.ID)
        .query(`SELECT COUNT(*) AS count FROM credentials WHERE userID = ${user.ID}`);
        // const updateUserQuery = ''
        if (passwordExistsResult.recordset[0].count > 0) {
            // update password if it exists
            await request.query(`UPDATE credentials SET password = '${hashedpassword}' WHERE userID = ${user.ID}`);
            // updateUserQuery = `UPDATE credentials SET password = '${hashedpassword}' WHERE userID = ${user.ID}`;
        }else{
            // Insert password if one doesn't exist
            await request.query(`insert into credentials (userID,[password])
            Values('${user.ID}','${hashedpassword}')`);
        }
        // const updateUserQuery = `
        //     UPDATE credentials SET password = '${hashedpassword}' WHERE userID = ${user.ID}
        // `;
    
        // await request.query(updateUserQuery);
        const removeResetTokenQuery = `DELETE FROM ResetTokens WHERE token = '${token}'`;
        await request.query(removeResetTokenQuery);
        res.redirect('/')
        //   res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
    }
  });
//   app.get('/standings/individual/:league', async (req, res, next) => {
//     try{
//         const request = pool.request()
//             const result = await request
//             .query(`DECLARE @league varchar(255)
//             Set @league = '${req.params.league}'
//             Execute leagueStandings @league
//             `)
//         var data = {
//             league: req.params.league,
//             page: req.originalUrl.split('/')[1],
//             list: result.recordsets[0]
//         }
        
//         res.render('index.ejs',{data: data})
//     }catch(err){
//         console.error('Error:', err)
//     }
// })
  app.get('/standings/:type/:league', async (req, res, next) => {
    try{
        const request = pool.request()
        const result = await request
        .query(`DECLARE @league varchar(255)
        Set @league = '${req.params.league}'
        Execute ${req.params.type}Standings @league
        `)
        var data = {
            league: req.params.league,
            type: req.params.type,
            page: `${req.originalUrl.split('/')[1]}`,
            list: result.recordsets[0],
            user: req.user
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
app.post('/CSVExport', async (req, res, next) => {
    try{
        
        const request = pool.request()
        const result = await request
        .query(req.body.queryString)
        const csvData = await functions.exportToCSV(result);
        console.log(csvData)
        // Set response headers for CSV download
        res.setHeader('Content-disposition', 'attachment; filename=data.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvData);
        // var data = {
        //     league: req.params.league,
        //     type: req.params.type,
        //     page: `${req.originalUrl.split('/')[1]}`,
        //     list: result.recordsets[0]
        // }
        
        // res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
app.post(['/paidChanges'], async (req,res,next)=>{
    // res.status(500);

    // Send a JSON response with the error message
    // res.json({ error: 'An error occurred while processing your request.' });
    try{
        
        const request = pool.request()
        if(Object.keys(req.body).length >0){
            console.log(req.body);
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
        console.log(err)
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
app.get('/admin', checkAuthenticated, authRole('admin'), (req, res) => {
    // Only accessible by users with admin role
    res.send('Admin Page');
});
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
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        const result = await request.query(`Select * from gamesList() order by startUnixTime, location`)
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
            page: req.route.path[0].replace('/',''),
            user: req.user
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
            page: req.route.path[0].replace('/',''),
            user: req.user
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        // console.log(req.user)
        const request = pool.request()
        const result = await request.query(`SELECT winners.*, 
        games.Start_Date, 
        games.Start_Time, 
        games.[Location], 
        games.Team1_ID, 
        games.Team2_ID, 
        games.season, 
        games.subseason, 
        games.league 
        from dbo.winners
        LEFT join games on winners.Event_ID=games.Event_ID
        order by paid`)
        data.winners = result.recordsets[0] 
        // console.log(data.winners) 
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
app.get(['/users'], async (req,res, next)=>{
    try{
        var data = {
            page: req.route.path[0].replace('/',''),
            user: req.user
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
            Event_ID: req.query.Event_ID,
            user: req.user
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
app.post('/gameInfo', async (req, res, next) => {
    // Process form data here
    try{
        var data = {
        }
        const formData = req.body;
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        // console.log(formData.Event_ID)
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
        SELECT userId,roleId,firstName,lastName
        FROM [user_role]
        left join users on user_role.userId=users.ID
        where roleId in (select id from roles where name in ('scorekeeper'))`)
        data.game = result.recordsets[0][0]
        data.teams = result.recordsets[1]
        data.scoreKeepers = result.recordsets[2]
        res.json({ message: 'Form submitted successfully!', data: data });
    }catch(err){
        next(err)
    }
  });
app.post('/updateGameInfo', async (req, res, next) => {
// Process form data here
    try{
        // var data = {
        // }
        const formData = req.body;

        const request = pool.request()

        result = await request.query(`
        update games
        set Team1_ID = '${formData.Team1_ID}',
        Team2_ID = '${formData.Team2_ID}',
        scoreKeeperId = ${formData.scoreKeeper_ID == 'TBD'? null : formData.scoreKeeper_ID}
        where Event_ID = '${formData.Event_ID}'
        `)
        res.json({ message: 'Data updated successfully!' });
    }catch(err){
        next(err)
    }
});
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
app.post('/send-email', async (req, res) => {
    // const { recipientEmail, subject, message } = req.body;

    try {
        // const response = await mailchimp.transactional.messages.send({
        //     message: {
        //         subject: 'test',
        //         text: 'testing',
        //         to: [{
        //             email: 'forslund.scott@gmail.com',
        //         }],
        //     },
        // });
        // const run = async () => {
        //     // const response = await mailchimp.marketing.lists
        //     // const response = await mailchimp.marketing.lists.getListMembersInfo("0e63a5b642")
        //     const response = await mailchimp.marketing.lists.getAllLists();
            
        //     // const response = await mailchimp.marketing.lists.getList({
        //     //     name: { match: 'Greater Lansing Open Soccer'}
        //     // })
        //     console.log(response.lists[0].name)
        //     console.log(response.lists.find(obj => obj.name === 'Greater Lansing Open Soccer'));
        //   };
        //   run()

        // console.log('Email sent:', response);
        // console.log(await mailchimp.getListByName('Greater Lansing Open Soccer'))
        console.log(await mailchimp.getCampaigns())
        // await mailchimp.sendMessage('forslund.scott@gmail.com','Testing Madrill Email', 'Testing Transactional email sending through MailChimp module Madrill.')
        // console.log((await mailchimp.getListMembers((await mailchimp.getListByName('Greater Lansing Open Soccer')).id)).members.length)
        // const listId = (await mailchimp.getListByName('Greater Lansing Open Soccer')).id
        // console.log(await mailchimp.getMemberTags(listId,(await mailchimp.getListMembers(listId)).members[1].id))
        // console.log(await mailchimp.getLists());
        res.send('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Failed to send email');
    }
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
        if(req.session){
            if(req.session.passport){
                delete req.session.passport
                res.redirect('back')
            }
        }
        // req.logOut((err)=> {
        //     if(err){return next(err)}
        //     res.redirect('/login')
        // })
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
function authRole(roleName){
    
    // try{
    
    
    return async (req,res,next)=>{
        try{
        const role = ROLES[roleName]
        console.log(role)
        const request = pool.request()
        const result = await request
        .query(`select roleId
                from user_role
                where userId = ${req.user.id}
        `)
        if(result.recordset.some(record=> record.roleId === role)){
            console.log('match');
            return next()
        }
        console.log('no');
        return res.status(403).end()
        }catch(err){
            console.error('Error:', err)
        }
    }
    // }catch(err){
    //     console.error('Error:', err)
    // }
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
