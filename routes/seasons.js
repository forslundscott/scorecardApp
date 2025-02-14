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
router.post(['/:seasonId/registration'], async (req, res, next) => {
    try{
        let data = {
            page: `/season/register`,
            user: req.user
            
        }
        console.log(req.body)
        await pool.request()
        .input('userId', sql.Int, req.user.id)
        .input('firstName', sql.VarChar, req.body.firstName)
        .input('lastName', sql.VarChar, req.body.lastName)
        // .input('preferredName', sql.VarChar, req.body.preferredName) // May add later
        .input('email', sql.VarChar, req.body.email)
        .input('phone', sql.VarChar(20), req.body.phone)
        .input('dob', sql.BigInt, new Date(req.body.dob).getTime())
        .input('gender', sql.VarChar, req.body.gender)
        .input('skill', sql.Int, req.body.skill)
        .input('discounted', sql.Bit, req.body.discounted)
        .input('shirtSize', sql.VarChar, req.body.shirtSize)
        .input('emergencyContactFirstName', sql.VarChar, req.body.emergencyContactFirstName)
        .input('emergencyContactLastName', sql.VarChar, req.body.emergencyContactLastName)
        .input('emergencyContactPhone', sql.VarChar(20), req.body.emergencyContactPhone)
        .input('emergencyContactRelationship', sql.VarChar, req.body.emergencyContactRelationship)
        .input('allergies', sql.VarChar, `${req.body.allergies}`)
        .input('medicalConditions', sql.VarChar, `${req.body.medicalConditions}`)
        .query(`
            update users
            set firstName = @firstName,
            lastName = @lastName,
            email = @email,
            phone = @phone,
            dob = @dob,
            gender = @gender,
            skill = @skill,
            discounted = @discounted,
            shirtSize = @shirtSize,
            emergencyContactFirstName = @emergencyContactFirstName,
            emergencyContactLastName = @emergencyContactLastName,
            emergencyContactPhone = @emergencyContactPhone,
            emergencyContactRelationship = @emergencyContactRelationship,
            allergies = @allergies,
            medicalConditions = @medicalConditions
            where ID = @userId
            `)
        console.log(req.body)

        res.redirect(`/seasons/${req.params.seasonId}/registration`);
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
        let result = await pool.request()
        .input('userId', sql.Int, data.user.id)
        .input('seasonId', sql.Int, req.params.seasonId)
        .query(`
            SELECT * from users
            WHERE ID = @userId;
            select * from league_season as ls 
            left join leagues as l on ls.leagueId=l.abbreviation
            where seasonId = @seasonId
            select * from seasons
            where seasonId = @seasonId
            `)
            
            data.userAttributes = result.recordsets[0][0]
            data.leagues = result.recordsets[1]
            data.season = result.recordsets[2][0]
            data.userAttributes.allergies = data.userAttributes.allergies.split(',').map(allergy => allergy.trim())
            data.userAttributes.medicalConditions = data.userAttributes.medicalConditions.split(',').map(medical => medical.trim())
            // console.log(data.userAttributes.allergies.split(',').map(allergy => allergy.trim()))
            for(let league of data.leagues){
                result = await pool.request()
                .input('leagueId', sql.VarChar, league.leagueId)
                .input('seasonId', sql.Int, req.params.seasonId)
                .query(`
                    select * from teams
                    where league = @leagueId and seasonId = @seasonId
                    `)
                league.teams = result.recordset
            }
            // console.log(data.leagues[0].teams)
        res.render('seasonRegistration.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get(['/:seasonId'], async (req, res, next) => {
    try{
        let data = {
            page: `season/details`,
            user: req.user
            
        }
        // const result = await pool.request()
        // .input('userId', sql.Int, data.user.id)
        // .query(`
        //     SELECT * from users
        //     WHERE ID = @userId;
        //     `)
        //     data.userAttributes = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.get('/', async (req,res, next)=>{
    try{
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
