const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/new'], async (req, res, next) => {
    try{
        const request = pool.request()
        
        var data = {
            page: `/newFacility`,
            user: req.user
            
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/add', async (req, res, next) => {
    // Process form data here
    try{
        const request = pool.request()
        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM facilities WHERE name = '${req.body.name}')
            BEGIN
                insert into facilities (name, address)
                values ('${req.body.name}','${req.body.address}')
            END
            `)
        res.redirect(302,'/facilities')
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
        var data = {
            
            page: 'facilities',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`select * from facilities
            order by name
        `)
        data.list = result.recordset
        res.render('index.ejs',{data: data}) 
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
