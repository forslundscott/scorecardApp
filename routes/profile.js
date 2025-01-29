// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        
    }catch(err){
        next(err)
    }
});
// Export the router so it can be used in other files
module.exports = router;
