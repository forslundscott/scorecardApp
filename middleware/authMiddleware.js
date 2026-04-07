const sql = require('mssql');
function checkAuthenticated(req, res, next) {
    try{
        if (req.isAuthenticated()) {
            return next()
        }
        req.session.returnTo = req.originalUrl
        res.redirect('/auth/login')
    }catch(err){
        console.error('Error:', err)
    }    
}

function checkNotAuthenticated(req, res, next) {
    try{
        if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    next();
    }catch(err){
        console.error('Error:', err)
    }    
}

function authRole(role){
    return async (req,res,next)=>{
        try{
        if(req.user.roles.some(userRole=> userRole.id === role || userRole.name === role)){
            return next()
        }
        return res.status(403).end()
        }catch(err){
            console.error('Error:', err)
        }
    }
}

async function loginUser(req, res, pool, userId) {
    // Fetch user
    const userResult = await pool.request()
        .input('id', sql.Int, userId)
        .query(`
            SELECT firstName, id, email, banned
            FROM users
            WHERE id = @id
        `);

    const user = userResult.recordset[0];

    if (!user) {
        throw new Error(`User ${userId} not found`);
    }

    // BANNED USER CHECK
    if (user.banned && user.banned !== 0) {
        // user.banned could be 1 or any truthy nonzero value
        throw new Error("User is banned and cannot log in.");
    }

    // Load roles
    const rolesResult = await pool.request()
        .input('id', sql.Int, userId)
        .query(`
            SELECT r.id, r.name
            FROM user_role ur
            LEFT JOIN roles r ON ur.roleId = r.id
            WHERE ur.userId = @id
        `);

    user.roles = rolesResult.recordset;
    // PROMISIFY req.login()
        const redirectUrl = req.session.returnTo || '/';
        delete req.session.returnTo;
    req.login(user, function(err) {
        if (err) throw err;

        // Redirect to home or wherever
        
        res.redirect(redirectUrl);
    });

    // return user; // return user in case route needs it
}

module.exports = {
    checkAuthenticated,
    checkNotAuthenticated,
    authRole,
    loginUser
}