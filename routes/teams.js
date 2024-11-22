// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
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
// router.post('/:userId/teams/addTeam', async (req,res, next)=>{
//     try{
//         console.log(`test ${req.params.userId}`)
//         var data = {
//             user: req.user,
//             page: 'user/newRole',
//             userId: req.params.userId
//         }
//         console.log(req.body)
//         const request = pool.request()
//         const result = await request.query(`
//             insert into user_team (userId,teamId)
//             values (${req.params.userId},'${req.body.teamId}')
//             `)
//             // console.log(result.recordsets[0])
        
//         // data.roles = result.recordset
//         // res.render('index.ejs',{data: data})
//         res.redirect(302,`/users/${req.params.userId}/teams`)
//     }catch(err){
//         next(err)
//     }
// });
// router.get('/:userId/teams/newTeam', async (req,res, next)=>{
//     try{
//         const request = pool.request()
        
//         var data = {
//             page: `user/newTeam`,
//             user: req.user
            
//         }
//         var result = await request
//         .query(`select top 1 seasonName from seasons where active = 1
//              and not seasonName = 'Test Season'
//         `)
//             data.season = result.recordset[0].seasonName
//         result = await request
//         .query(`select seasonName from seasons where active = 1
//         `)
//         data.seasons = result.recordset
//         result = await request
//         .query(`SELECT * from league_season ls
//             LEFT join leagues l on ls.leagueId=l.abbreviation
//             where seasonId = '${data.season}'
//         `)
//         // console.log(req)
        
//         data.leagues = result.recordset
//         console.log(data)
//         res.render('index.ejs',{data: data})
//     }catch(err){
//         console.error('Error:', err)
//     }
// });
// router.get('/:userId/teams/:teamId', async (req,res, next)=>{
//     try{
//         console.log(`test ${req.params.userId}`)
//         var data = {
//             user: req.user,
//             page: 'users/roles/role',
//             userId: req.params.userId,
//             roleId: req.params.teamId
//         }
//         // const request = pool.request()
//         // const result = await request.query(`
//         //     select userId, preferredName,lastName, roleId, name
//         //     from user_role as ur 
//         //     LEFT join users as u on ur.userId=u.ID
//         //     left join roles as r on ur.roleId=r.id
//         //     where userId = ${req.params.userId}
//         //     `)
//         //     // console.log(result.recordsets[0])
        
//         // data.list = result.recordset
//         res.render('index.ejs',{data: data})
//     }catch(err){
//         next(err)
//     }
// });
// router.get('/:userId/teams', async (req,res, next)=>{
//     try{
//         console.log(`newtest ${req.params.userId}`)
//         var data = {
//             user: req.user,
//             page: 'users/teams',
//             userId: req.params.userId
//         }
//         const request = pool.request()
//         const result = await request.query(`
//             select userId, preferredName,lastName, teamId, t.fullName
//             from user_team as ut 
//             LEFT join users as u on ut.userId=u.ID
//             left join teams as t on ut.teamId=t.id
//             where userId = ${req.params.userId}
//             `)
//             // console.log(result.recordsets[0])
        
//         data.list = result.recordset
//         res.render('index.ejs',{data: data})
//     }catch(err){
//         next(err)
//     }
// });
// router.post('/:userId/roles/addRole', async (req,res, next)=>{
//     try{
//         console.log(`test ${req.params.userId}`)
//         var data = {
//             user: req.user,
//             page: 'user/newRole',
//             userId: req.params.userId
//         }
//         console.log(req)
//         const request = pool.request()
//         const result = await request.query(`
//             insert into user_role (userId,roleId)
//             values (${req.params.userId},${req.body.roleId})
//             `)
//             // console.log(result.recordsets[0])
        
//         // data.roles = result.recordset
//         // res.render('index.ejs',{data: data})
//         res.redirect(302,`/users/${req.params.userId}/roles`)
//     }catch(err){
//         next(err)
//     }
// });
router.get('/:teamId/roster/newPlayer', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'team/newPlayer',
            teamId: req.params.teamId
        }
        const request = pool.request()
        var result = await request.query(`
            select season from teams
            where id = '${req.params.teamId}'
            `)
            // console.log(result.recordsets[0])
        data.leagueId = result.recordset[0].league
        // data.roles = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
// router.get('/:userId/roles/:roleId', async (req,res, next)=>{
//     try{
//         console.log(`test ${req.params.userId}`)
//         var data = {
//             user: req.user,
//             page: 'users/roles/role',
//             userId: req.params.userId,
//             roleId: req.params.roleId
//         }
//         // const request = pool.request()
//         // const result = await request.query(`
//         //     select userId, preferredName,lastName, roleId, name
//         //     from user_role as ur 
//         //     LEFT join users as u on ur.userId=u.ID
//         //     left join roles as r on ur.roleId=r.id
//         //     where userId = ${req.params.userId}
//         //     `)
//         //     // console.log(result.recordsets[0])
        
//         // data.list = result.recordset
//         res.render('index.ejs',{data: data})
//     }catch(err){
//         next(err)
//     }
// });
router.get('/:teamId/roster', async (req,res, next)=>{
    try{
        
        var data = {
            user: req.user,
            page: 'team/roster',
            userId: req.params.userId
        }
        const request = pool.request()
        const result = await request.query(`
            select userId, preferredName,lastName
            from user_team as ut
            LEFT join users as u on ut.userId=u.ID
            left join teams as t on ut.teamId=t.id
            where teamId = '${req.params.teamId}'
            `)
            // console.log(result.recordsets[0])
        
        data.list = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.post('/:teamId/editTeam', async (req,res, next)=>{
    try{
        console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'team/editTeam',
            teamId: req.params.teamId
        }
        // console.log(req)
        const request = pool.request()
        const result = await request.query(`
            UPDATE teams
            set fullName = '${req.body.fullName}',
            shortName = '${req.body.shortName}',
            color = '${req.body.color}',
            league = '${req.body.leagueId}',
            season = '${req.body.seasonId}'
            where ID = '${req.params.teamId}'
            `)
            // console.log(result.recordsets[0])
        
        // data.roles = result.recordset
        // res.render('index.ejs',{data: data})
        res.redirect(302,`/teams/${req.params.teamId}`)
    }catch(err){
        next(err)
    }
});
router.get('/:teamId/editTeam', async (req,res, next)=>{
    try{
        // console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: '/editTeam'
        }
        const request = pool.request()
        var result = await request.query(`
            SELECT * 
            from dbo.teams
            where id = '${req.params.teamId}'
            `)
            console.log(result.recordsets[0])
        
        data.data = result.recordset[0]
        data.data.color = functions.getHexColor(data.data.color)
        result = await request
        .query(`select seasonName from seasons where active = 1
        `)
        data.seasons = result.recordset
        result = await request
        .query(`SELECT * from league_season ls
            LEFT join leagues l on ls.leagueId=l.abbreviation
            where seasonId = '${data.data.season}'
        `)
        // console.log(req)
        
        data.leagues = result.recordset
        res.render('index.ejs',{data: data})
    }catch(err){
        next(err)
    }
});
router.get('/:teamId', async (req,res, next)=>{
    try{
        // console.log(`test ${req.params.userId}`)
        var data = {
            user: req.user,
            page: 'teams/details'
        }
        const request = pool.request()
        const result = await request.query(`
            SELECT * 
            from dbo.teams
            where id = '${req.params.teamId}'
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
        console.log(req.user)
        // if (req.isAuthenticated()) {
        //     // console.log(req.user)
        // }
        var data = {
            page: `teams`,
            user: req.user
        }
        // const pool = new sql.ConnectionPool(config)
        // await pool.connect();
        const request = pool.request()
        // where convert(date,DATEADD(s, startunixtime/1000, '1970-01-01') AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,'01-07-2024')
        // const result = await request.query(`Select * from gamesList() where convert(date,DATEADD(s, startunixtime/1000, '19700101')AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time') = CONVERT(date,getdate()) order by startUnixTime, location `)
        const result = await request.query(`select t.id, t.fullName, t.color, t.abbreviation, u.firstName + ' ' + u.lastName as captain, l.color as LeagueColor from teams as t
            left join leagues as l on t.league=l.abbreviation
            LEFT join users as u on t.captain=u.ID
            where season in (select seasonName from seasons
            where active = 1)
            ORDER by t.league, fullName
        `)
        data.teams = result.recordset
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
