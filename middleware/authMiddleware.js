function checkAuthenticated(req, res, next) {
    try{
        if (req.isAuthenticated()) {
            return next()
        }
        res.redirect('/auth/login')
    }catch(err){
        console.error('Error:', err)
    }    
}

function checkNotAuthenticated(req, res, next) {
    try{
        if (req.isAuthenticated()) {
            return res.redirect('/')
        }
        next()
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


module.exports = {
    checkAuthenticated,
    checkNotAuthenticated,
    authRole
}