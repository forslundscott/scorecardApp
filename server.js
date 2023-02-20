const express = require("express")
const app = express()
const port = 3000
let options = {}

app.use(express.urlencoded({ extended: true }))
app.use(express.static('public',options))
app.set('view-engine','ejs')

// Helpers and Routes
const functions = require('./helpers/functions')
// const forms = require('./routes/forms')
// app.use('/forms',forms)
app.locals.functions = functions

// var connection = functions.getAccess()

var team1 = {
    name: 'HON',
    keeper: 'Morgan',
    players: [
        'Scott',
        'Taylor',
        'J',
        'Nandan',
        'Jeremy',
        'Brendan',
        'Moses',
        'Mitch',
        'Nikki',
        'Yusif',
        'Greg',
        'Khalid'
    ]
}

var team2 = {
    name: 'BSG',
    keeper: 'Owen',
    players: [
        'Nicole',
        'Ali',
        'Mehdi',
        'Stephani',
        'Dan',
        'Sammy'
    ]
}

app.get(['/'], async (req,res)=>{
    // res.render('index.ejs')  
    res.render('smartphone.ejs') 
})
app.get(['/display'], async (req,res)=>{
    // res.render('index.ejs')  
    var data = {
        teams: [
            team1,
            team2
        ]
    }
    res.render('index.ejs',data) 
})
app.post(['/'], async (req,res)=>{
    // res.render('index.ejs')
    res.render('smartphone.ejs') 
})
app.listen(port, function(err){
    // if (err) console.log(err);
 })