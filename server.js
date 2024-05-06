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
const processingStatus = {};
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
    maxAge: 24*60*60*1000
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
// sequelize.sync()

// Helpers and Routes
const functions = require('./helpers/functions');
const scheduler = require('./helpers/scheduler');
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

    const resetLink = `${req.protocol}://${req.hostname}/reset/${token}`;
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
        // console.log(req.params)
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
app.get(['/standings','/schedules'], async (req, res, next) => {
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`DECLARE @league varchar(255)
        // Set @league = '${req.params.league}'
        // Execute ${req.params.type}Standings @league
        // `)
        var data = {
            page: `${req.originalUrl.split('/')[1]}`,
            user: req.user
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
app.get(['/schedules/list'], async (req, res, next) => {
    try{
        const request = pool.request()
        const result = await request
        .query(`select * from schedules
        `)
        console.log(req.originalUrl)
        var data = {
            page: `${req.originalUrl}`,
            user: req.user,
            list: result.recordsets[0]
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
app.post(['/schedules/list'], async (req, res, next) => {
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`select * from schedule_games
        // where scheduleId = '${req.scheduleId}'
        // `)
        // console.log(req.originalUrl)
        // var data = {
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
app.get(['/schedules/new'], async (req, res, next) => {
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`DECLARE @league varchar(255)
        // Set @league = '${req.params.league}'
        // Execute ${req.params.type}Standings @league
        // `)
        console.log(req.originalUrl)
        var data = {
            page: `${req.originalUrl}`,
            user: req.user
        }
        
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
app.post(['/schedules/new'], async (req, res, next) => {
    try{
        console.log(req.body)
        const request = pool.request()
        var leagueList = scheduler.leagueSchedule(await getLeaguesForScheduler(req.body.sport, req.body.seasonId),parseInt(req.body.gamesPerTeam))
        var allRegularGames = []
        var allGames = []
        var allGameDays = []
        var scheduleName = req.body.scheduleName !== '' ? req.body.scheduleName : `${req.body.seasonId} ${req.body.sport}`
        var timeParts = req.body.firstGameTime.split(':')
        var firstGameTime = (timeParts[0]*3600 + timeParts[1]*60)*1000
        var dailyGameTimesCount = req.body.lastGameTime.split(':')[0]-req.body.firstGameTime.split(':')[0]+1
        var totalFields = 4
        var timeFieldList = []
        for(var i=0;i<totalFields;i++){
            // ((i)*1000*60*60)+firstGameTime
            for(var j=0;j<dailyGameTimesCount;j++){
                var timeFieldItem = {
                    timeMs: ((j)*1000*60*60)+firstGameTime
                }
                timeFieldItem.fieldNumber = i+1
                timeFieldList.push(timeFieldItem)
            }
        }
        // console.log(timeFieldList)
        var seasonStartDate = new Date(req.body.seasonStartDate)
        seasonStartDate = new Date(`${seasonStartDate.toLocaleDateString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
          })}`)
        var seasonEndDate = new Date(req.body.seasonEndDate)
        seasonEndDate = new Date(`${seasonEndDate.toLocaleDateString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        })}`)
        // console.log(`${seasonStartDate.toLocaleDateString()} to ${seasonEndDate.toLocaleDateString()}`)
        // setting match days for all leagues
        for(var league of leagueList){
            var gameDays = playableDays(seasonStartDate.toLocaleDateString(),seasonEndDate.toLocaleDateString(),league.dayOfWeek)
            var matchesPerPlayableDay = (league.scheduleMatches.length+league.playoffMatches.length)/gameDays.length
            var daysWithExtraGame = Math.round((matchesPerPlayableDay%1)*gameDays.length)
            var imatch = 0
            
            // console.log(`${league.leagueId} ${league.playoffMatches.length} ${league.scheduleMatches.length} ${matchesPerPlayableDay} ${daysWithExtraGame} ${gameDays.length}`)
            // console.log(league.teams.length);
            var allMatches = []
            allMatches = allMatches.concat(league.scheduleMatches,league.playoffMatches)
            // allMatches.push(league.scheduleMatches)
            // allMatches.push(league.playoffMatches)
            // var copyAllMatches =[...allMatches]
            // console.log(`${allMatches.length} ${copyAllMatches.length}`)
            // console.log(allMatches)
            // console.log(league.scheduleMatches.length);;
            for(var i=0;i<gameDays.length;i++){
                if(!allGameDays.some(obj => obj.getTime() === gameDays[i].getTime())){
                    allGameDays.push(gameDays[i])
                }
                if(i<daysWithExtraGame){
                    var numberOfMatches = Math.ceil(matchesPerPlayableDay)
                }else{
                    // console.log('floor');
                    var numberOfMatches = Math.floor(matchesPerPlayableDay)
                }
                // console.log(`${league.leagueId} ${numberOfMatches} ${league.totalRegularSeasonGames} ${imatch} ${league.playoffs} ${league.teams.length}`)
                for(var j=0;j<numberOfMatches;j++){
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
                    var matchesNoDate = allMatches.filter(obj => obj.startDate === null)
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
                    for(var k=0;k<matchesNoDate.length;k++){
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

            // for(var i=0;i<league.scheduleMatches;i++){
            //     // need to account for playoffs as well
            //     var imatch = league.scheduleMatches(i)


            // }
            allGames = allGames.concat(league.scheduleMatches)
            allGames = allGames.concat(league.playoffMatches)
            // allRegularGames = allRegularGames.concat(league.scheduleMatches)
        }
        allGames.sort((a, b) => a.startDate - b.startDate)
        // console.log(allGameDays)
        // setting match times
        for(var i=0;i< allGameDays.length;i++){
            // console.log(`${i} ${allGameDays.length}`);
            var currentGameDay = allGameDays[i]
            // console.log(currentGameDay.getTime())
            // for(var igame of allGames){
            //     console.log(igame);
            // }
            // console.log(allGames[1]);
            var currentTimeFieldList = [...timeFieldList]
            var currentDayMatches = allGames.filter(obj => obj.startDate.getTime() === currentGameDay.getTime())
            // console.log(timeFieldList)
            var fieldNumber = 1
            var maxFieldNumber = 4
            var timeNumber = 0
            // var firstHour = 6+12
            for(var j=0;j< currentDayMatches.length;j++){
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
                for(var k=0;k<currentTimeFieldList.length;k++){
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
        // for(var i=0;i<allGames.length;i++){
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
app.get(['/schedules/item/:scheduleId'], async (req, res, next) => {
    try{
        const request = pool.request()
        const result = await request
        .query(`select * from schedule_games
        where scheduleId = '${req.params.scheduleId}'
        select name from schedules
        where scheduleId = '${req.params.scheduleId}'
        `)
        console.log(req.originalUrl)
        var data = {
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
app.post('/standings', async (req, res, next) => {
    try{
        // const request = pool.request()
        // const result = await request
        // .query(`DECLARE @league varchar(255)
        // Set @league = '${req.params.league}'
        // Execute ${req.params.type}Standings @league
        // `)
        // var data = {
        //     page: `${req.originalUrl.split('/')[1]}`,
        //     user: req.user
        // }
        // console.log(req.body)
        res.redirect(`/standings/${req.body.type}/${req.body.leagueId}`)
        // res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
app.post('/exportStandings', async (req, res, next) => {
    try{
        
        const request = pool.request()
        const result = await request
        .query(req.body.queryString)
        const csvData = await functions.exportToCSV(result.recordset);
        console.log(csvData)
        // Set response headers for CSV download
        res.setHeader('Content-disposition', `'attachment; filename=${req.body.fileName}.csv'`);
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvData);
    }catch(err){
        console.error('Error:', err)
    }
})
app.post('/exportSchedules', async (req, res, next) => {
    try{
        const request = pool.request()
        
        // var result = await request
        // .query(
        //     `select distinct leagueId from schedule_games
        //     where scheduleId = ${req.body.scheduleId}`
        // )
        // var leagueArray = result.recordset
        // for(var ileague of leagueArray){
        //     var csvData = ''
        //     result = await request
        //     .query(
        //         `select distinct CONVERT(DATE, startDate, 101) as ds, startDate from schedule_games
        //         where scheduleId = ${req.body.scheduleId} and leagueId = '${ileague.leagueId}'
        //         ORDER BY CONVERT(DATE, startDate, 101)`
        //     )
        //     var dateArray = result.recordset
        //     for(var idate of dateArray){
        //         result = await request
        //         .query(
        //             `select distinct CONVERT(DATE, startDate, 101) as ds, startDate from schedule_games
        //             where scheduleId = ${req.body.scheduleId} and leagueId = '${ileague.leagueId}'
        //             ORDER BY CONVERT(DATE, startDate, 101)`
        //         )
        //         csvData = `${csvData}\n\n${(await functions.exportToCSV(result.recordset))}`
        //     }
        // }
        result = await request
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
            where scheduleId = ${req.body.scheduleId}
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
app.post('/periodEnd', async (req, res, next) => {
    try{
        // check if it has been called for this event yet
        if(processingStatus[req.body.Event_ID]){
            res.status(409).send('Request with this id is already being processed.')
        }else {
            processingStatus[req.body.Event_ID] = true;
            var game
            const request = pool.request()
            const result = await request
            .query(`SELECT * FROM [scorecard].[dbo].[games] WHERE event_Id = '${req.query.Event_ID}'`)
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
        console.log(req.user)
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
        console.log(req.protocol)
        console.log(req.hostname)
        var game
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        let result = await request.query(`Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team1_ID}' and keeper in (Select userId from [scorecard].[dbo].[user_team] where teamid ='${req.query.Team1_ID}')
        Select * from [scorecard].[dbo].[teams] where id ='${req.query.Team2_ID}' and keeper in (Select userId from [scorecard].[dbo].[user_team] where teamid ='${req.query.Team2_ID}')`)
        if(result.recordsets[0].length == 0){
            // var pool = await sql.connect(config)
            // pool.request()
            await request.query(`
            update teams
            set keeper = (Select top 1 userId from [scorecard].[dbo].[user_team] where teamid ='${req.query.Team1_ID}')
            where id = '${req.query.Team1_ID}'
            `)
        }
        if(result.recordsets[1].length == 0){
            // var pool = await sql.connect(config)
            // pool.request()
            await request.query(`
            update teams
            set keeper = (Select top 1 userId from [scorecard].[dbo].[user_team] where teamid ='${req.query.Team2_ID}')
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
        next(err)
    }
})
app.post(['/checkEmail'], async (req,res,next)=>{
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
app.post(['/getPastSubs'], async (req,res,next)=>{
    try{
        const request = pool.request()
        result = await request.query(`
        SELECT distinct users.*
        FROM subTeamGame
        LEFT JOIN users ON subTeamGame.userId = users.ID
        WHERE subTeamGame.teamId = '${req.body.team}' 
        AND NOT EXISTS (
            SELECT 1
            FROM subTeamGame AS sg
            WHERE sg.userId = subTeamGame.userId
                AND sg.teamId = '${req.body.team}'
                AND sg.eventId = '${req.body.eventId}'
  );`)
        // console.log(`
        // select users.* 
        // from subTeamGame
        // left JOIN users on subTeamGame.userId=users.ID
        // where teamId='${req.body.team}' and not eventId='${req.body.eventId}'`)
        console.log(result.recordset)
        res.json({ message: 'Success', subs: result.recordset })
        // res.redirect('back')
    }catch(err){
        next(err)
    }
})
app.post(['/addPastSub'], async (req,res,next)=>{
    try{
        const request = pool.request()
        result = await request.query(`
        insert into subTeamGame (userId,teamId,eventId)
        VALUES ('${req.body.existingSubs}','${req.body.team}','${req.body.eventId}')`)
        // console.log(`
        // select users.* 
        // from subTeamGame
        // left JOIN users on subTeamGame.userId=users.ID
        // where teamId='${req.body.team}' and not eventId='${req.body.eventId}'`)
        console.log(req.body)
        res.json({ message: 'Success'})
        // res.redirect('back')
    }catch(err){
        next(err)
    }
})
app.post(['/addPlayer'], async (req,res,next)=>{
    try{
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        var result = await request.query(`select id from users
        where email = '${req.body.email}'`)
        if(!result.recordset[0]){
            // console.log(req.body.season)
            // console.log(req.body.team)
            // console.log(result.recordset[0].id)
            // result = await request.query(`DECLARE @userId varchar(255)
            // DECLARE @teamId varchar(255)
            // DECLARE @seasonId varchar(255)
            
            // set @email = '${req.body.email}'
            // set @teamId = '${req.body.team}'
            // set @seasonId = '${req.body.season}'
            
            // EXECUTE [dbo].[insert_userTeamSeason] 
            //    @email
            //   ,@teamId
            //   ,@seasonId
            // `)
        // }else{
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
            set @preferredName = '${req.body.preferredName}'
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
            `)
        }
        // console.log(result.recordset[0])
        // await request.query(`insert into scorecard.dbo.players (Team, Player, Id, firstName, lastName, playerType) VALUES('${req.body.team}','${req.body.firstName} ${req.body.lastName}','${req.body.firstName}${req.body.lastName}','${req.body.firstName}','${req.body.lastName}','${req.body.playerType}')`)
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
            UPDATE games
            SET status = 
                CASE
                    WHEN CAST(period as DECIMAL) / maxperiods > cast(2 as decimal)/3 THEN 2
                    ELSE 1
                END 
            WHERE event_id = '${formData.Event_ID}'
            AND status = 0;
            `)
            res.redirect(302,'/games')
        }else{
            res.json({ message: 'Data updated successfully!' });
        }
        
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

  
app.get(['/test'], async (req,res)=>{
    // var data = {
    // // }
    const request = pool.request()
        // result = await request.query(`insert into schedules (season,sport,name)
        // values ('Indoor','Soccer', 'Indoor Soccer')`)
    //     data.teams = result.recordsets[0]
    //     // console.log(result.recordsets[0])
    //     for(var iteam of data.teams){
    //         result = await request.query(`exec conflictingTeams @teamId='${iteam.teamId}'`)
    //         iteam.conflictingTeams = result.recordsets[0].map(item => item.teamId)
    //         // console.log(iteam.conflictingTeams)
    //     }
    var sportName = 'Soccer'
    var leagueName = 'Indoor'
    var leagueList = scheduler.leagueSchedule(await getLeaguesForScheduler(sportName, leagueName),8)
    var allRegularGames = []
    for(var league of leagueList){
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
        // console.log(await getLeaguesForScheduler('Soccer', 'Indoor'))
    res.status(204).send()
})                                                

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
function playableDays(startDate,endDate,dayOfWeek){
    // var totalDays = 1 + Math.round((d1-d0)/(24*3600*1000))
    var firstGameDate = new Date(startDate)
    var lastGameDate = new Date(endDate)
    var msInWeek = 1000*60*60*24*7
    var holidays = [new Date('May 24, 2024'),
        new Date('May 27, 2024'),
        new Date('July 4, 2024'),
        new Date('July 5, 2024'),
        new Date('July 8, 2024'),
        new Date('August 30, 2024'),
        new Date('September 2, 2024')
    ]
    var gameDays = []
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
    for(var i=0;i<((lastGameDate.getTime()-firstGameDate.getTime())/msInWeek)+1;i++){
        var newDate = new Date(firstGameDate.getTime()+(i*msInWeek))
        // newDate.setDate(firstGameDate.getTime()+(i*msInWeek))
        // console.log(firstGameDate.getDate()+(i*7))
        if(!holidays.some(function (holiday) {return holiday.getTime() === newDate.getTime()})){
            gameDays.push(newDate)
        }
    }
//     var holidaysDuringSeason = holidays.filter(date => 
//         {
//         var currentHoliday = new Date(date)
//         return currentHoliday.getDay() === dayOfWeek 
//         && currentHoliday >= firstGameDate 
//         && currentHoliday <= lastGameDate
//     }
// ).length
    return gameDays
    // return ((lastGameDate-firstGameDate)/msInWeek)+1 - holidaysDuringSeason
}
async function getTeamsForScheduler(xSport, xSeason){
    var teams = []
    const request = pool.request()
        result = await request.query(`exec teamListForScheduler @sport='${xSport}', @season='${xSeason}'`)
        teams = result.recordsets[0]
        for(var iteam of teams){
            result = await request.query(`exec conflictingTeams @teamId='${iteam.teamId}'`)
            iteam.conflictingTeams = result.recordsets[0].map(item => item.teamId)
            iteam.gamesPlayed = 0
        }
        return teams
}
async function getLeaguesForScheduler(xSport, xSeason){
    var teams = []
    var leagues = []
    var league = {}
    const request = pool.request()
        result = await request.query(`exec teamListForScheduler @sport='${xSport}', @season='${xSeason}'`)
        teams = result.recordsets[0]
        for(var iteam of teams){
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
        // for(var ileague of leagues){
        //     console.log(ileague)
        // }
        return leagues
}
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
