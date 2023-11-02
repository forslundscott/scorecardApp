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

// var connection = functions.getAccess()
var gameInfo = {
    name: '',
    homeTeam: '',
    awayTeam: '',
    period: 1,
    time: ''
}
class Game {
    constructor(){
        this.name = ''
        this.homeTeam = new Team
        this.awayTeam = new Team
        this.period = 1
        this.time = ''
    }
}
class GameEvent {
    constructor(){
        this.timeStamp = ''
        this.period = 1
        this.team = ''
        this.player = ''
        this.event = ''
        this.value = 0
    }
}
class Team {
    constructor(){
        this.keeper = ''
        this.goalsFor = 0
        this.goalsAgainst = 0
        this.assits = 0
        this.saves = 0
        this.players = {}
    }
}
class Player {
    constructor(){
        this.firstName = ''
        this.lastName = ''
        this.goals = 0
        this.assits = 0
        this.ownGoals = 0
    }
}

var team1 = {
    id: "BEER",
    name: "We're Here for the Beer",
    keeper: {id: 'MorganAbney',
                firstName: 'Morgan',
                lastName: 'Abney'
            },
    players: [
        {id: 'ScottForslund',
            firstName: 'Scott',
            lastName: 'Forslund'
        },
        {id: 'TaylorHori',
            firstName: 'Taylor',
            lastName: 'Hori'
        },
        {id: 'JustinTeel',
            firstName: 'Justin',
            lastName: 'Teel'
        },
        {id: 'NandanTandan',
            firstName: 'Nandan',
            lastName: 'Tandan'
        },
        {id: 'JeremyAshcroft',
            firstName: 'Jeremy',
            lastName: 'Ashcroft'
        },
        {id: 'BrendanBarnes',
            firstName: 'Brendan',
            lastName: 'Barnes'
        },
        {id: 'MitchBrown',
            firstName: 'Mitch',
            lastName: 'Brown'
        },
        {id: 'NikkiBrown',
            firstName: 'Nikki',
            lastName: 'Brown'
        },
        {id: 'GregKruger',
            firstName: 'Greg',
            lastName: 'Kruger'
        },
        {id: 'MorganAbney',
            firstName: 'Morgan',
            lastName: 'Abney'
        }
    ]
}

var team2 = {
    id: 'BSG',
    name: 'The Branch SG',
    keeper: {id: 'MorganAbney',
                firstName: 'Morgan',
                lastName: 'Abney'
            },
    players: [
        {id: 'ScottForslund',
            firstName: 'Scott',
            lastName: 'Forslund'
        },
        {id: 'TaylorHori',
            firstName: 'Taylor',
            lastName: 'Hori'
        },
        {id: 'JustinTeel',
            firstName: 'Justin',
            lastName: 'Teel'
        },
        {id: 'NandanTandan',
            firstName: 'Nandan',
            lastName: 'Tandan'
        },
        {id: 'JeremyAshcroft',
            firstName: 'Jeremy',
            lastName: 'Ashcroft'
        },
        {id: 'BrendanBarnes',
            firstName: 'Brendan',
            lastName: 'Barnes'
        },
        {id: 'MitchBrown',
            firstName: 'Mitch',
            lastName: 'Brown'
        },
        {id: 'NikkiBrown',
            firstName: 'Nikki',
            lastName: 'Brown'
        },
        {id: 'GregKruger',
            firstName: 'Greg',
            lastName: 'Kruger'
        },
        {id: 'JosephAzako',
            firstName: 'Joseph',
            lastName: 'Azako'
        },
        {id: 'MorganAbney',
            firstName: 'Morgan',
            lastName: 'Abney'
        }
    ]
}
var games = []
function tempLoadGame(){
    var activeGame = new Game
    activeGame.homeTeam.keeper = 'MorganAbney'
    activeGame.awayTeam.keeper = 'MorganAbney'

    for(var i=0;i<team1.players.length;i++){
        var newPlayer = new Player
        newPlayer.firstName = team1.players[i].firstName
        newPlayer.lastName = team1.players[i].lastName
        newPlayer.id = newPlayer.firstName + newPlayer.lastName
        activeGame.homeTeam.players[newPlayer.id]= newPlayer
    }
    for(var i=0;i<team2.players.length;i++){
        var newPlayer = new Player
        newPlayer.firstName = team2.players[i].firstName
        newPlayer.lastName = team2.players[i].lastName
        newPlayer.id = newPlayer.firstName + newPlayer.lastName
        activeGame.awayTeam.players[newPlayer.id]= newPlayer
    }
    console.log(activeGame.awayTeam.players[1])
    for(var i=0;i<activeGame.awayTeam.players.length;i++){
        console.log(activeGame.awayTeam.players)
    }
    
}
tempLoadGame()
app.get(['/'], async (req,res)=>{
    // res.render('index.ejs')
    res.redirect('/activeGame')
    // res.render('smartphone.ejs') 
})
app.get(['/games'], async (req,res)=>{
    // res.render('index.ejs')
    const sql = require('mssql');
    const config = {
        server: 'scott-HP-Z420-Workstation',
        database: 'scorecard',
        user: 'SRF',
        password: 'Planbsk8!!8ksbnalP',
        trustServerCertificate: true,
    };

    sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT * FROM [scorecard].[dbo].[games]`)
    }).then(result => {
        games = result.recordset
        // console.log(games)
        // console.log(result.recordset[0].Location)
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    console.log(req.route.path[0])
    var data = {
        teams: [
            team1,
            team2
        ],
        page: req.route.path[0].replace('/','')
    }
    res.render('index.ejs',data) 
})
app.get(['/activeGame'], async (req,res)=>{
    // res.render('index.ejs')
    const sql = require('mssql');
    const config = {
        server: 'scott-HP-Z420-Workstation',
        database: 'scorecard',
        user: 'SRF',
        password: 'Planbsk8!!8ksbnalP',
        trustServerCertificate: true,
    };

    sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT * FROM [scorecard].[dbo].[players] Where Team='BEER'`)
    }).then(result => {
        games = result.recordset
        // console.log(games)
        // console.log(result.recordset[0].Location)
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    console.log(games)
    var data = {
        teams: [
            team1,
            team2
        ],
        page: req.route.path[0].replace('/','')
    }
    res.render('index.ejs',data) 
})
app.get(['/display'], async (req,res)=>{
    // res.render('index.ejs')
    const sql = require('mssql');
    const config = {
        server: 'scott-HP-Z420-Workstation',
        database: 'scorecard',
        user: 'SRF',
        password: 'Planbsk8!!8ksbnalP',
        trustServerCertificate: true,
    };

    sql.connect(config).then(pool => {
        // Query
        return pool.request()
            .query(`SELECT * FROM [scorecard].[dbo].[players] Where Team='BEER'`)
    }).then(result => {
        games = result.recordset
        // console.log(games)
        // console.log(result.recordset[0].Location)
    }).catch(err => {
        console.log(err)
    // ... error checks
    });  
    console.log(games)
    var data = {
        teams: [
            team1,
            team2
        ],
        page: req.query.page
    }
    res.render('index.ejs',data) 
})
app.post(['/'], async (req,res)=>{
    // res.render('index.ejs')
    res.render('smartphone.ejs') 
})
app.post(['/eventLog'], async (req,res)=>{
    eventLog.push(req.body)
    console.log(eventLog)
    res.sendStatus(204)
})


app.get(['/schedule'], async (req,res)=>{
    const sql = require('mssql');
    const config = {
        server: 'scott-HP-Z420-Workstation',
        database: 'scorecard',
        user: 'SRF',
        password: 'Planbsk8!!8ksbnalP',
        trustServerCertificate: true,
    };

sql.connect(config).then(pool => {
    // Query
    return pool.request()
        .query(`SELECT top 1 * FROM [scorecard].[dbo].[games1$]`)
}).then(result => {
    console.log(result.recordset[0].Location)
}).catch(err => {
    console.log(err)
  // ... error checks
});
console.log('test')
    // res.sendStatus(204)
})
app.listen(port, function(err){
    // if (err) console.log(err);
 })
// eventLog
//  res.sendStatus(200)