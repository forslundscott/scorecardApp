// routes/users.js
const express = require('express');
const router = express.Router();

// Define a GET route for `/users`
router.get('/', async (req,res, next)=>{
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
});

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
