const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/newSeason'], async (req, res, next) => {
    try{
        const request = pool.request()
        
        var data = {
            page: `/newSeason`,
            user: req.user
            
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addSeason', async (req, res, next) => {
    // Process form data here
    try{
        const request = pool.request()
        await request.query(`
            IF NOT EXISTS (SELECT 1 FROM seasons WHERE seasonName = '${req.body.seasonName}')
            BEGIN
                insert into seasons (seasonName, active)
                values ('${req.body.seasonName}',${req.body.active ? 1 : 0})
            END
            `)
        res.redirect(302,'/seasons')
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
            
            page: 'seasons',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`select * from seasons
            order by active desc
        `)
        data.seasons = result.recordset
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
