const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
// const sql = require('mssql');

function initialize(passport, getUserByEmail, getUserById){
    const authenticateUser = async (email, password, done) => {
        try{
            email = email.replace(/'/g, '')
            const result = await getUserByEmail(email)
            if(result.recordset.length == 0){
                return done(null, false, {message: 'No user with that email'})
            }
            const user = result.recordset[0]
            console.log(user)
            try {
                if (!user.password) {
                    return done(null, false, {message: 'Please use Forgot Password for your first time logging into the new site.'});
                } else if(await bcrypt.compare(password, user.password)){
                    return done(null, user)
                } else {
                    return done(null, false, {message: 'Password incorrect'})
                }
            } catch (e) {
                return done(e)
            }
        }catch(err){
            console.log(err)
            return done(null, false, {message: err.message})
        }
    }
    passport.use(new LocalStrategy({usernameField: 'email', session: true},
    authenticateUser))
    passport.serializeUser((user, done) => done(null, user.id))
    passport.deserializeUser(async (id, done) => {
        const user = await getUserById(id)
        // const user = result
        return done(null, user)
    })
}
module.exports = initialize