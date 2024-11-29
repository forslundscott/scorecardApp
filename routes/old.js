const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post(['/paidChanges'], async (req,res,next)=>{
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

    }
})
router.get(['/winners'], async (req,res, next)=>{
    try{
        var data = {
            page: req.route.path[0].replace('/',''),
            user: req.user
        }

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

        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
})
router.get('/', async (req,res, next)=>{
    // try{
    //  
    // }catch(err){
    //     next(err)
    // }
});

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
