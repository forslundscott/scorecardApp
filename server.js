if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require("express")
const app = express()
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const Sequelize = require('sequelize');
const SessionStore = require('express-session-sequelize')(session.Store)
const methodOverride = require('method-override')
const initializePassport = require('./passport-config')
const pool = require(`./db`)
const sql = require('mssql');
// const helmet = require('helmet');

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

app.use(express.urlencoded({ extended: true }))
const defineSession = require('./models/session');
const Session = defineSession(sequelize);
const sessionStore = new SessionStore({
    db: sequelize,
    table: 'Session',
});
initializePassport(
    passport, 
    async email => {
            const request = pool.request()
            const result = await request
            .input('email', sql.VarChar, email)
            .query(`select t1.firstName, t1.id, t1.email, t2.password 
            from users as t1
            LEFT JOIN credentials as t2 
            on t1.ID=t2.userID
            where t1.email = @email`)
            return result
        },
    async id => {
            const request = pool.request()
            var result = await request
            .input('id', sql.Int, id)
            .query(`select firstName, id, email
            from users
            where id = @id`)
            const user = result.recordset[0]
            result = await request
            // .input('id', sql.Int, id)
            .query(`select r.id, r.name
            from user_role as ur
            left join roles as r on ur.roleId=r.id
            where ur.userId = @id`)
            user.roles = result.recordset
            return user
        }
    )

// app.use(helmet()); // Basic security headers
const staticOptions = require('./config/staticOptions');
app.use(express.static('public', staticOptions));
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
app.use((req, res, next) => {
    console.log(req.path)
    next()
  });
// Helpers and Routes
app.use('/users', require(`./routes/users`));
app.use('/games', require(`./routes/games`));
app.use('/teams', require(`./routes/teams`));
app.use('/seasons', require(`./routes/seasons`));
app.use('/facilities', require(`./routes/facilities`));
app.use('/pickup', require(`./routes/pickup`));
app.use('/leagues', require(`./routes/leagues`));
app.use('/standings', require(`./routes/standings`));
app.use('/auth', require(`./routes/auth`))
app.use('/notifications', require(`./routes/notifications`))
app.use('/api/payments', require(`./routes/payments`))
app.use('/schedules', require(`./routes/schedules`))
app.use('/old', require(`./routes/old`))
const functions = require('./helpers/functions');

const { checkAuthenticated, checkNotAuthenticated, authRole } = require('./middleware/authMiddleware')
app.locals.functions = functions


app.get(['/'], async (req,res)=>{
    try{
        res.redirect('/games')
    }catch(err){
        console.error('Error:', err)
    }    
})

app.use((req, res, next) => {
    res.render('doesNotExist.ejs')
  });
app.use(require('./middleware/errorHandler'));

// app._router.stack.forEach((middleware) => {
//     console.log(middleware.name || 'anonymous middleware', middleware.route ? middleware.route.path : '');
// });


app.listen(process.env.APP_PORT, function(err){
    // if (err) console.log(err);
 })
