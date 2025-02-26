// routes/users.js
const express = require('express');
const router = express.Router();
const sql = require('mssql');
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const processingStatus = {};
router.get(['/new'], async (req, res, next) => {
    try{

        
        let data = {
            page: `/newPickup`,
            user: req.user
            
        }
        const request = pool.request()
        const result = await request.query(`select * from facilities
        `)
        data.facilities = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/add', async (req, res, next) => {
    // Process form data here
    try{

        // Ensure pickupHours is an array
        const pickupHours = Array.isArray(req.body.pickupHours)
            ? req.body.pickupHours
            : [req.body.pickupHours];
        const request = pool.request()
        for (const hour of pickupHours) {
            console.log(hour)
        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM pickupEvents WHERE date = ${req.body.date} and time = ${hour})
            BEGIN
                insert into pickupEvents (date, time, totalSlots, notifyAt, facilityId, active)
                values (${req.body.date},${hour},${req.body.totalSlots},${req.body.notifyAt},${req.body.facilityId},${req.body.active ? 1 : 0})
            END
            `)
        }
        // res.redirect(302,'/pickup')
        res.redirect('back')
    }catch(err){
        next(err)
    }
  });
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
router.get('/register/:date', async (req,res, next)=>{
    try{
        // console.log(req.user)
        // if (req.isAuthenticated()) {
        //     // console.log(req.user)
        // }
        let data = {
        }
        // console.log(req.originalUrl)

        const request = pool.request()

        let result = await request.query(`
            select e.*, (select count(a.userId) 
            from pickupAttendees as a
            where e.id=a.pickupId) attendeeCount 
            from pickupEvents as e
            where [date] = ${req.params.date} 
        `)
        // const result = await request.query(`Select * from gamesList() order by startUnixTime, location `)
        data.pickupEvents = result.recordset
        res.render('pickupRegistration.ejs',{data: data}) 
        // res.render('venmoPickupRegistration.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:unixDate/:unixTime', async (req,res, next)=>{
    try{
        console.log(req.user)
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            
            page: 'pickupItem',
            user: req.user
        }
        const result = await pool.request()
        .query(`select * from pickupEvents as pe
            left join facilities as f on pe.facilityId=f.id
            order by date
        `)
        data.list = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});
router.get('/:pickupId', async (req,res, next)=>{
    try{
        console.log(req.user)
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            
            page: 'pickupItem',
            user: req.user
        }
        const result = await pool.request()
        .input('pickupId', sql.Int, req.params.pickupId)
        .query(`SELECT * from pickupAttendees
            where pickupId = @pickupId
        `)
        data.list = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});
router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            
            page: 'pickup',
            user: req.user
        }
        const result = await pool.request()
        .query(`select 
            pe.id,
            pe.[date], 
            pe.facilityId, 
            pe.active, 
            f.address, 
            f.name from pickupEvents as pe
            left join facilities as f on pe.facilityId=f.id
            order by date
        `)
        data.list = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});

module.exports = router;
