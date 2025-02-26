const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/new'], async (req, res, next) => {
    try{
        let data = {
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
        await request
        .input('name', sql.VarChar, req.body.name)
        .input('address', sql.VarChar, req.body.address)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM facilities WHERE name = @name)
            BEGIN
                insert into facilities (name, address)
                values (@name,@address)
            END
            `)
        res.redirect(302,'/facilities')
    }catch(err){
        next(err)
    }
  });
router.get('/', async (req,res, next)=>{
    try{
        let data = {
            
            page: 'facilities',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`
            select * from facilities
            order by name
        `)
        data.list = result.recordset
        res.render('index.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});

module.exports = router;
