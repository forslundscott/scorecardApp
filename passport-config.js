const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
// const sql = require('mssql');

function initialize(passport, getUserByEmail2, getUserById2, getUserByEmail, getUserById){
    const authenticateUser = async (email, password, done) => {
        const result = await getUserByEmail(email)
        if(result.recordset.length == 0){
            return done(null, false, {message: 'No user with that email'})
        }
        const user = result.recordset[0]
        // console.log(user)
        // if(user == null){
        //     return done(null, false, {message: 'No user with that email'})
        // }
        try {
            if(await bcrypt.compare(password, user.password)){
                return done(null, user)
            } else {
                return done(null, false, {message: 'Password incorrect'})
            }
        } catch (e) {
            return done(e)
        }
    }
    passport.use(new LocalStrategy({usernameField: 'email'},
    authenticateUser))
    passport.serializeUser((user, done) => done(null, user.id))
    passport.deserializeUser((id, done) => {
        return done(null, getUserById(id))
    })
}
module.exports = initialize