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
            // if (req.hostname.startsWith('app.')) {
            //     const redirectUrl = req.originalUrl || 'https://envoroot.com'
            //     // return res.redirect(301, `${req.protocol}://${mainDomain}${req.originalUrl}`);
            //     return res.redirect(301, redirectUrl)
            // }
            let redirectUrl 
            
            // if (req.hostname.startsWith('app.')) {
            //     redirectUrl = 'https://envoroot.com/';
            // } else if (['forslundhome.duckdns.org', 'glosoccer.org', 'www.glosoccer.org'].includes(req.headers.host)) {
            //     redirectUrl = `https://${req.headers.host}/comingsoon`;
            // } else {
            //     redirectUrl = '/';
            // }
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