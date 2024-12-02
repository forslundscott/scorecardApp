// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const processingStatus = {};

router.post('/register', (req, res) => {
    const { name, email, priceId } = req.body;
    
    // Store the registration data temporarily
    registrationData = { name, email, priceId };

    // Redirect to confirmation page
    res.redirect('/pickup/confirmation');
});
router.get('/confirmation', (req, res) => {
    const { name, email, priceId } = registrationData;

    // Display the registration details and total cost
    res.render('registrationConfirmation.ejs', { name, email, cost: 20, priceId }); // Cost for registration
});
router.get('/register', async (req,res, next)=>{
    try{
        // console.log(req.user)
        // if (req.isAuthenticated()) {
        //     // console.log(req.user)
        // }
        // var data = {
        //     teams: [],
        //     page: 'games',
        //     user: req.user
        // }
        // console.log(req.originalUrl)

        // const request = pool.request()
        // // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        // const result = await request.query(`Select * from gamesList() order by startUnixTime, location `)
        // data.games = result.recordset
        res.render('pickupRegistration.ejs') 
    }catch(err){
        next(err)
    }
});

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
