const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql'); 
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/newSeason'], async (req, res, next) => {
    try{
        let data = {
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
        await pool.request()
        .input('seasonName',sql.VarChar, req.body.seasonName)
        .input('active', sql.Bit, req.body.active ? 1 : 0)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM seasons WHERE seasonName = @seasonName)
            BEGIN
                insert into seasons (seasonName, active)
                values (@seasonName, @active)
            END
            `)
        res.redirect(302,'/seasons')
    }catch(err){
        next(err)
    }
  });
router.post(['/:seasonId/register'], async (req, res, next) => {
    try{
        let data = {
            page: `/season/register`,
            user: req.user
            
        }
        // res.render('seasonRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/:seasonId/registration'],checkAuthenticated, async (req, res, next) => {
    try{
        let data = {
            page: `/season/register`,
            user: req.user
            
        }
        // console.log(data.user.id)
        const result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .query(`
            DECLARE @cols NVARCHAR(MAX), @query NVARCHAR(MAX)

            SELECT @cols = STRING_AGG(QUOTENAME(attributeName), ',')
            FROM (SELECT DISTINCT attributeName FROM userAttributes) AS attr;

            SET @query = '
            WITH PivotedAttributes AS (
                SELECT userId, ' + @cols + '
                FROM (
                    SELECT ua.userId, ua.attributeName, ua.attributeValue
                    FROM userAttributes ua
                ) AS src
                PIVOT (
                    MAX(attributeValue) FOR attributeName IN (' + @cols + ')
                ) AS pvt
            )
            SELECT u.ID, u.email, u.firstName, u.lastName, u.preferredName, ' + @cols + '
            FROM users u
            LEFT JOIN PivotedAttributes pa ON u.ID = pa.userId
            WHERE u.ID = @userId;';

            EXEC sp_executesql @query, N'@userId INT', @userId;

            `)
            console.log(result.recordset)
            data.userAttributes = result.recordset[0]
        res.render('seasonRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        if (req.isAuthenticated()) {
            // console.log(req.user)
        }
        let data = {
            
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
