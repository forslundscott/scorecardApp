const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql'); 
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.post('/userSearch', async (req, res) => {
    const query  = req.body.userSearchValue;

    if (!query) {
        return res.status(400).send('Query parameter is required');
    }

    try {
        const result = await pool.request()
        .input('query', sql.VarChar, `%${query}%`)
        .query(`
            SELECT * FROM users 
            WHERE firstName LIKE @query
            OR lastName LIKE @query 
            OR preferredName LIKE @query 
            OR email LIKE @query
            OR firstName + ' ' + lastName LIKE @query
            OR preferredName + ' ' + lastName LIKE @query
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Query failed: ', err);
        res.status(500).send('Internal server error');
    }
});
router.get(['/newUser'], async (req, res, next) => {
    try{       
        let data = {
            page: `/newUser`,
            user: req.user
            
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addUser', async (req, res, next) => {
    try{
        await functions.addUserToDatabase(req.body);
        res.redirect(302,'/games')
    }catch(err){
        next(err)
    }
  });
router.post('/:userId/teams/addTeam', async (req,res, next)=>{
    try{
        await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .input('teamId', sql.VarChar, req.body.teamId)
        .query(`
            insert into user_team (userId,teamId)
            values (@userId,@teamId)
            `)
        res.redirect(302,`/users/${req.params.userId}/teams`)
    }catch(err){
        next(err)
    }
});
router.get('/:userId/teams/newTeam', async (req,res, next)=>{
    try{
        let data = {
            page: `user/newTeam`,
            user: req.user
        }
        let result = await pool.request()
        .query(`select top 1 * from seasons where active = 1
             and not seasonName = 'Test Season'
        `)
            data.season = result.recordset[0]
        result = await pool.request()
        .query(`select * from seasons where active = 1
        `)
        data.seasons = result.recordset
        result = await pool.request()
        .input('seasonId', sql.Int, data.season.seasonId)
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = @seasonId
        `)
        data.leagues = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
});
router.get('/:userId/teams/:teamId', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'users/teams/team',
            userId: req.params.userId,
            roleId: req.params.teamId
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId/teams', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'users/teams',
            userId: req.params.userId
        }
        const result = await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .query(`
            select userId, preferredName,lastName, teamId, t.fullName
            from user_team as ut 
            LEFT join users as u on ut.userId=u.ID
            left join teams as t on ut.teamId=t.id
            where userId = @userId
            `)
        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:userId/roles/addRole', async (req,res, next)=>{
    try{
        await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .input('roleId', sql.Int, req.body.roleId)
        .query(`
            insert into user_role (userId,roleId)
            values (@userId,@roleId)
            `)

        res.redirect(302,`/users/${req.params.userId}/roles`)
    }catch(err){
        next(err)
    }
});
router.get('/:userId/roles/newRole', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'user/newRole',
            userId: req.params.userId
        }
        const result = await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .query(`
            select * 
            from roles
            where not id in (
                select roleId 
                from user_role 
                where userId = @userId
                )
            `)        
        data.roles = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId/roles/:roleId', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'users/roles/role',
            userId: req.params.userId,
            roleId: req.params.roleId
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId/roles', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'users/roles',
            userId: req.params.userId
        }
        const result = await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .query(`
            select userId, preferredName,lastName, roleId, name
            from user_role as ur 
            LEFT join users as u on ur.userId=u.ID
            left join roles as r on ur.roleId=r.id
            where userId = @userId
            `)
        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:userId/editUser', async (req,res, next)=>{
    try{
        await pool.request()
        .input('firstName', sql.VarChar, req.body.firstName)
        .input('lastName', sql.VarChar, req.body.lastName)
        .input('preferredName', sql.VarChar, req.body.preferredName)
        .input('email', sql.VarChar, req.body.email)
        .input('userId', sql.Int, req.params.userId)
        .query(`
            UPDATE users
            set firstName = @firstName,
            lastName = @lastName,
            preferredName = @preferredName,
            email = @email
            where ID = @userId
            `)
        res.redirect(302,`/users/${req.params.userId}`)
    }catch(err){
        next(err)
    }
});
router.get('/:userId/editUser', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: '/editUser'
        }
        const result = await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .query(`
            SELECT * 
            from dbo.users
            where id = @userId
            `)
        
        data.data = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId', async (req,res, next)=>{
    try{
        let data = {
            user: req.user,
            page: 'users/details'
        }
        const result = await pool.request()
        .input('userId', sql.Int, req.params.userId)
        .query(`
            SELECT * 
            from dbo.users
            where id = @userId
            `)        
        data.data = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

router.get('/', async (req,res, next)=>{
    try{
        let data = {
            page: 'users',
            user: req.user
        } 
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

module.exports = router;
