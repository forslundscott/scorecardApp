// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

// Define a GET route for `/users`
// router.get('*', async (req,res, next)=>{
//         console.log(req)
//         next()
//     })
router.post('/userSearch', async (req, res) => {
    const query  = req.body.userSearchValue;

    if (!query) {
        return res.status(400).send('Query parameter is required');
    }

    try {
        const request = pool.request()
        const result = await request.query(`
            SELECT * FROM users 
            WHERE firstName LIKE '%${query}%' 
            OR lastName LIKE '%${query}%' 
            OR preferredName LIKE '%${query}%' 
            OR email LIKE '%${query}%'
            OR firstName + ' ' + lastName LIKE '%${query}%'
            OR preferredName + ' ' + lastName LIKE '%${query}%'
        `);
        // console.log(result.recordset)
        res.json(result.recordset);
    } catch (err) {
        console.error('Query failed: ', err);
        res.status(500).send('Internal server error');
    }
});
router.get(['/newUser'], async (req, res, next) => {
    console.log('test')
    try{       
        var data = {
            page: `/newUser`,
            user: req.user
            
        }
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/addUser', async (req, res, next) => {
    // Process form data here
    try{
        await addUserToDatabase(req.body);
        // const request = pool.request()
        // await request.query(`
        //     IF NOT EXISTS (SELECT 1 FROM users WHERE email = '${req.body.email}')
        //     BEGIN
        //         insert into users (firstName, lastName, preferredName, email)
        //         values ('${req.body.firstName}','${req.body.lastName}','${req.body.preferredName == '' ? req.body.firstName : req.body.preferredName}','${req.body.email}')
        //     END
        //     `)
        res.redirect(302,'/games')
    }catch(err){
        next(err)
    }
  });
router.post('/:userId/teams/addTeam', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'user/newRole',
            userId: req.params.userId
        }
        console.log(req.body)
        const request = pool.request()
        const result = await request.query(`
            insert into user_team (userId,teamId)
            values (${req.params.userId},'${req.body.teamId}')
            `)
            // console.log(result.recordsets[0])
        

        res.redirect(302,`/users/${req.params.userId}/teams`)
    }catch(err){
        next(err)
    }
});
router.get('/:userId/teams/newTeam', async (req,res, next)=>{
    try{
        const request = pool.request()
        
        var data = {
            page: `user/newTeam`,
            user: req.user
            
        }
        var result = await request
        .query(`select top 1 seasonName from seasons where active = 1
             and not seasonName = 'Test Season'
        `)
            data.season = result.recordset[0].seasonName
        result = await request
        .query(`select seasonName from seasons where active = 1
        `)
        data.seasons = result.recordset
        result = await request
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = '${data.season}'
        `)
        // console.log(req)
        
        data.leagues = result.recordset
        console.log(data)
        res.render('index.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
});
router.get('/:userId/teams/:teamId', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'users/roles/role',
            userId: req.params.userId,
            roleId: req.params.teamId
        }
        // const request = pool.request()
        // const result = await request.query(`
        //     select userId, preferredName,lastName, roleId, name
        //     from user_role as ur 
        //     LEFT join users as u on ur.userId=u.ID
        //     left join roles as r on ur.roleId=r.id
        //     where userId = ${req.params.userId}
        //     `)
        //     // console.log(result.recordsets[0])
        
        // data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId/teams', async (req,res, next)=>{
    try{
        console.log(`newtest ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'users/teams',
            userId: req.params.userId
        }
        const request = pool.request()
        const result = await request.query(`
            select userId, preferredName,lastName, teamId, t.fullName
            from user_team as ut 
            LEFT join users as u on ut.userId=u.ID
            left join teams as t on ut.teamId=t.id
            where userId = ${req.params.userId}
            `)
            // console.log(result.recordsets[0])
        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:userId/roles/addRole', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'user/newRole',
            userId: req.params.userId
        }
        console.log(req)
        const request = pool.request()
        const result = await request.query(`
            insert into user_role (userId,roleId)
            values (${req.params.userId},${req.body.roleId})
            `)

        res.redirect(302,`/users/${req.params.userId}/roles`)
    }catch(err){
        next(err)
    }
});
router.get('/:userId/roles/newRole', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'user/newRole',
            userId: req.params.userId
        }
        const request = pool.request()
        const result = await request.query(`
            select * 
            from roles
            where not id in (
                select roleId 
                from user_role 
                where userId = ${req.params.userId}
                )
            `)
            // console.log(result.recordsets[0])
        
        data.roles = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId/roles/:roleId', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'users/roles/role',
            userId: req.params.userId,
            roleId: req.params.roleId
        }
        // const request = pool.request()
        // const result = await request.query(`
        //     select userId, preferredName,lastName, roleId, name
        //     from user_role as ur 
        //     LEFT join users as u on ur.userId=u.ID
        //     left join roles as r on ur.roleId=r.id
        //     where userId = ${req.params.userId}
        //     `)
        //     // console.log(result.recordsets[0])
        
        // data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId/roles', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'users/roles',
            userId: req.params.userId
        }
        const request = pool.request()
        const result = await request.query(`
            select userId, preferredName,lastName, roleId, name
            from user_role as ur 
            LEFT join users as u on ur.userId=u.ID
            left join roles as r on ur.roleId=r.id
            where userId = ${req.params.userId}
            `)
            // console.log(result.recordsets[0])
        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:userId/editUser', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'user/editUser',
            userId: req.params.userId
        }
        console.log(req)
        const request = pool.request()
        const result = await request.query(`
            UPDATE users
            set firstName = '${req.body.firstName}',
            lastName = '${req.body.lastName}',
            preferredName = '${req.body.preferredName}',
            email = '${req.body.email}'
            where ID = ${req.params.userId}
            `)
            // console.log(result.recordsets[0])
        
        // data.roles = result.recordset
        // res.render('index.ejs',{data: data})
        res.redirect(302,`/users/${req.params.userId}`)
    }catch(err){
        next(err)
    }
});
router.get('/:userId/editUser', async (req,res, next)=>{
    try{
        // console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: '/editUser'
        }
        const request = pool.request()
        const result = await request.query(`
            SELECT * 
            from dbo.users
            where id = ${req.params.userId}
            `)
            console.log(result.recordsets[0])
        
        data.data = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:userId', async (req,res, next)=>{
    try{
        // console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'users/details'
        }
        const request = pool.request()
        const result = await request.query(`
            SELECT * 
            from dbo.users
            where id = ${req.params.userId}
            `)
            console.log(req)
        
        data.data = result.recordset[0]
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});

router.get('/', async (req,res, next)=>{
    try{
        var data = {
            page: 'users',
            user: req.user
        }
        // console.log(req.originalUrl)
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
