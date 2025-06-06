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
const cors = require('cors');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
app.set('trust proxy', 'loopback');


const corsOptions = {
  origin: ['http://app.localhost.com:3000','http://localhost.com:3000', 'https://forslundhome.duckdns.org'], // Allow the app subdomain
  methods: ['GET', 'POST', 'OPTIONS'], // List allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow headers
  credentials: true, // Allow credentials if needed
};

app.use(cors(corsOptions));

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
            const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query(`select t1.firstName, t1.id, t1.email, t2.password, t1.banned
            from users as t1
            LEFT JOIN credentials as t2 
            on t1.ID=t2.userID
            where t1.email = @email`)
            return result
        },
    async id => {
            let result = await pool.request()
            .input('id', sql.Int, id)
            .query(`select firstName, id, email, banned
            from users
            where id = @id`)
            const user = result.recordset[0]
            result = await pool.request()
            .input('id', sql.Int, id)
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

app.post('/log-client-error', express.json(), (req, res) => {
    console.error('Client-side error:', req.body);
    res.sendStatus(200); // Respond to acknowledge receipt
});
app.get(['/comingsoon'], async (req,res)=>{
    try{
        res.render('comingSoon.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
app.get(['/rules'], async (req,res)=>{
    try{
        res.render('glosOutdoorRules.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
app.get(['/waiver'], async (req,res)=>{
    try{
        let data = {
            page: `/season/register`,
            user: req.user,
            seasonId: req.params.seasonId
            
        }
        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('seasonId', sql.Int, req.params.seasonId)
        .query(`
            SELECT * from users
            WHERE ID = @userId;

            select l.leagueId, ls.seasonId, ls.seasonName, ls.leagueAbbreviation, l.name as leagueName, l.gender, l.color as leagueColor, l.shortName as leagueShortName, l.sport, l.dayOfWeek, l.giftCards 
            from league_season as ls 
            left join leagues as l 
                on ls.leagueId = l.leagueId
            where ls.seasonId = @seasonId
            
            select * from seasons
            where seasonId = @seasonId;
            
            select srl.registrationId, srl.leagueId, srl.teamId, l.shortName as leagueShortName, t.shortName as teamShortName 
            from seasonRegistration_leagueTeam as srl
            left join leagues as l on srl.leagueId = l.leagueId
            left join teams as t on srl.teamId = t.teamId
            where srl.seasonId = @seasonId and srl.userId = @userId
            `)
            console.log('testing123')
            data.userAttributes = result.recordsets[0][0]
            data.userAttributes.dob = Number(data.userAttributes.dob)
            data.leagues = result.recordsets[1]
            data.season = result.recordsets[2][0]
            data.leaguesAlreadyRegistered = result.recordsets[3]
            console.log(data.leaguesAlreadyRegistered)
            data.userAttributes.allergies = data.userAttributes.allergies
            ? data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
            : [];
            data.userAttributes.medicalConditions = data.userAttributes.medicalConditions
            ? data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            : [];
            console.log(data.leagues)
            // data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            for(let league of data.leagues){
                console.log(league.leagueId)
                result = await pool.request()
                .input('leagueId', sql.VarChar, `${league.leagueId}`)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                    select slt.*
                        , t.fullName as teamFullName
                        , t.shortName as teamShortName
                        , t.abbreviation as teamAbbreviation
                        , t.color as teamColor
                        ,t.keeper as teamKeeper
                        ,t.captain as teamCaptain
                        , u.preferredName as captainPreferredName
                        , u.lastName as captainLastName 
                        from seasonLeagueTeam as slt
                        left join teams as t 
                            on slt.teamId=t.teamId
                        left join users as u 
                            on t.captain=u.ID
                    where 
                        slt.leagueId = @leagueId 
                        and slt.seasonId = @seasonId
                        and t.status = 'active'
                    `)
                league.teams = result.recordset
            }
        res.render('waiverForm.ejs', {data: data})
    }catch(err){
        console.error('Error:', err)
    }    
})

app.get(['/test'], async (req,res)=>{
    try{
        // functions.sendEmail('test','', 'Glos No Reply', 'Password Reset Test')
        // const session = await stripe.paymentIntents.retrieve('pi_3R9qIOFGzuNCeWUR05YeiQHb')
        // console.log(session)
        console.log(req.user)
        res.send('<p>test</p>');      
        
    }catch(err){
        console.error('Error:', err)
    }    
})

app.get(['/'], async (req,res)=>{
    try{
        let redirectUrl 
            
            if (['app.glosoccer.com', 'app.envoroot.com'].includes(req.headers.host)) {
                redirectUrl = 'https://glosoccer.com/';
            } else 
            if (['forslundhome.duckdns.org', 'glosoccer.com', 'www.glosoccer.com'].includes(req.headers.host)) {
                redirectUrl = `/comingsoon`;
            } else {
                redirectUrl = '/games';
            }


        res.redirect(redirectUrl)
    }catch(err){
        console.error('Error:', err)
    }    
})

app.use((req, res, next) => {
    res.render('doesNotExist.ejs')
  });
app.use(require('./middleware/errorHandler'));




app.listen(process.env.APP_PORT, function(err){
    
 })
