// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
let options = {
    maxAge: '1w', // Set max-age directive to 1 day
  etag: true, // Enable ETag
  lastModified: false, // Disable Last-Modified header
}
router.use(express.static('../public',options))
// Define a GET route for `/users`
// router.get('*', async (req,res, next)=>{
//         console.log(req)
//         next()
//     })
router.get('/:userId/teams', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'users/teams'
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
            // console.log(result.recordsets[0])
        
        // data.roles = result.recordset
        // res.render('index.ejs',{data: data})
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
            console.log(result.recordsets[0])
        
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
