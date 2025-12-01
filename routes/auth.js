const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt')
const passport = require('passport')
const nodemailer = require('nodemailer');
const pool = require(`../db`)
const sql = require('mssql'); 
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole, loginUser } = require('../middleware/authMiddleware');


router.get(['/login'], checkNotAuthenticated, async (req,res)=>{
    try{
        let data = {
            host: req.headers.host
        }
        // console.log(req.get('host'))
        let message = req.flash().message
        
        // console.log(req.flash())
        res.render('login.ejs', {messages: {message},data: data})
    }catch(err){
        console.error('Error:', err)
    }    
})
router.post(['/login'], function(req, res, next) { passport.authenticate('local', function(err, user, info, status) {
    if (err) { return next(err) }
    try{
        let data = {
            host: req.headers.host
        }
        console.log(!user)
        if (!user) { 
            req.flash('message', info.message)
            return res.redirect(info.redirect || '/auth/login')
            // return res.render(info.redirect || 'login.ejs', {messages: info, data}) 
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            const redirectUrl = req.session.returnTo || '/';
            delete req.session.returnTo;
            return res.redirect(redirectUrl);
        });
        // req.session.passport = {}
        // req.session.passport.user = user.id
        // console.log(user.id)
        
        // let redirectUrl = req.session.returnTo || '/';

        // delete req.session.returnTo;

        // res.redirect(redirectUrl);
    }catch(err){
        console.error('Error:', err)
    }
})(req, res, next)
})

router.delete('/logout', (req,res) => {
    try{
        req.logout(function(err) {
            if (err) { return next(err); }
            res.redirect(req.get('Referer') || '/');
        });
        // if(req.session){
        //     if(req.session.passport){
        //         delete req.session.passport
        //         res.redirect(req.get('Referer') || '/');

        //     }
        // }
    }catch(err){
        console.error('Error:', err)
    }    
})
router.get(['/createProfile'], async (req,res)=>{
    try{
        let data = {
            host: req.headers.host
        }
        res.render('createProfile.ejs',{data, messages: {message: req.flash().message}})
    }catch(err){
        console.error('Error:', err)
    }    
})

router.post(['/createProfile'], async (req,res,next)=>{
    let data = {
            host: req.headers.host
        }
    try {
        const emailExistsResult = await pool.request()
            .input('email', sql.VarChar, req.body.email)
            .query(`
                SELECT COUNT(*) AS count FROM users WHERE email = @email
                `);
        
        // If email already exists, respond with a message

        if (emailExistsResult.recordset[0].count > 0) {
            req.flash('message', 'User with specified email already exists. If you do not remember your password, please use Forgot Password link.')
            return res.redirect('/auth/login')
            // return res.render('createProfile.ejs', {data, messages: {message: 'User with specified email already exists. If you do not remember your password, please use Forgot Password link.'}})
        }
        const hashedpassword = await bcrypt.hash(req.body.password, 10)
        const insertResult = await pool.request()
        .input('email', sql.VarChar, req.body.email)
        .input('firstName', sql.VarChar, req.body.firstName)
        .input('lastName', sql.VarChar, req.body.lastName)
        .input('preferredName', sql.VarChar, req.body.preferredName)
        .input('password', sql.VarChar, hashedpassword)
        .query(`
            DECLARE @tempTable table (
                id int
            )
            
            insert into users (firstName, lastName, email, preferredName)
            OUTPUT inserted.id
            into @tempTable
            values (@firstName, @lastName, @email, @firstName)
            
            insert into credentials (userID,[password])
            select id, @password from @tempTable
            
            SELECT id FROM @tempTable
            `)        

        const newUserId = insertResult.recordset[0].id;
            
        loginUser(req,res,pool,newUserId)
            
        
    }catch(err){
        console.log(err)
        res.redirect('/auth/createProfile')
    }
    
})
router.get(['/forgotPassword'], async (req,res)=>{
    try{
        let data = {
            host: req.headers.host
        }
        res.render('forgotPassword.ejs',{data, messages: {message: req.flash().message}})
    }catch(err){
        console.error('Error:', err)
    }    
})
router.post(['/forgotPassword'], async (req,res)=>{
    const { email } = req.body;
  try {
    const result = await pool.request()
    .input('email', sql.VarChar, email)
    .query(
        `select firstName, id, email, [password] 
                        from users as t1
                        LEFT JOIN credentials as t2 
                        on t1.ID=t2.userID
                        where email = @email`
    );
    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate and save reset token
    const token = crypto.randomBytes(32).toString('hex');
    const resetLink = `${req.protocol}://${req.headers.host}/auth/reset/${token}`;
    await pool.request()
    .input('id', sql.Int, user.id)
    .input('token', sql.NVarChar(255), token)
    .input('returnTo', sql.VarChar(sql.MAX),req.session.returnTo)
    .query(
        `
      INSERT INTO ResetTokens (userId, token, returnTo, createdAt) VALUES (@id, @token, @returnTo, DATEDIFF_BIG(MILLISECOND, '1970-01-01', SYSUTCDATETIME()))
    `
    );
    let body = `Hello,

  We received a request to reset your password for your GLOS account. You can reset your password by clicking the link below:

  ${resetLink}

  If you didn’t request a password reset, please let us know.

  Regards,
  The GLOS Team
      `
    functions.sendEmail(body,user.email,'No Reply - GLOS', 'GLOS Account Password Reset',process.env.NO_REPLY_EMAIL,process.env.NO_REPLY_EMAIL_PASSWORD)
    // Send reset email
    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.titan.email',
    //     port: 587,
    //     // service: 'gmail',
    //     secure: false,
    //     auth: {
    //        user: process.env.ORG_EMAIL,
    //        pass: process.env.ORG_EMAIL_PASSWORD
    //     },
    //     // debug: false,
    //     // logger: true
    // });

//     const resetLink = `${req.protocol}://${req.headers.host}/auth/reset/${token}`;
//     const mailOptions = {
//       from: `No Reply - GLOS <${process.env.ORG_EMAIL}>`,
//       to: user.email,
//       subject: 'GLOS Account Password Reset',
//       text: `Hello,

//   We received a request to reset your password for your GLOS account. You can reset your password by clicking the link below:

//   ${resetLink}

//   If you didn’t request a password reset, please let us know.

//   Regards,
//   The GLOS Team
//       `,
//     };

    // transporter.sendMail(mailOptions, (error, info) => {
    //   if (error) {
    //     return console.error('Error sending reset email:', error);
    //   }
    //   console.log('Reset email sent:', info.response);
    //   req.session.message = `You should receive a reset link to your specified email shortly. 
    //   If you do not receive one, please check your spam folder.`
    //   return res.redirect('/auth/login')

    // });
    res.redirect('/auth/login')
  } catch (error) {
    console.error('Error finding user:', error);
  } 
})
router.get('/admin', checkAuthenticated, authRole('admin'), (req, res) => {
    // Only accessible by users with admin role
    console.log(req.user)
    res.send('Admin Page');
});
router.get('/reset/:token', async (req, res, next) => {
    try{
        let data = {
            host: req.headers.host
        }
        let message = req.flash().message
        res.render('resetPassword.ejs',{messages:{message},data})
    }catch(err){
        console.error('Error:', err)
    }
})

router.post('/reset/:token', async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;
        let data = {
            host: req.headers.host
        }
        if (password !== confirmPassword) {
            return res.render('resetPassword.ejs', { messages: {error: 'Passwords do not match'} })
        }
        // Use MSSQL to find reset token in the database
        const result = await pool.request()
        .input('token', sql.NVarChar(255), token)
        .query(`
            SELECT * FROM ResetTokens WHERE token = @token
            `);
        const resetToken = result.recordset[0];
    
        if (!resetToken) {
            return res.status(404).json({messages: { message: 'Invalid token' },data});
        }
    
        // Update user password and remove reset token
        const userResult = await pool.request()
        .input('userId', sql.Int, resetToken.userId)
        .query(
            `SELECT * FROM Users WHERE id = @userId`
        );
        const user = userResult.recordset[0];
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const hashedpassword = await bcrypt.hash(password, 10)
        const passwordExistsResult = await pool.request()
        .input('userId', sql.Int, user.ID)
        .query(`
            SELECT COUNT(*) AS count FROM credentials WHERE userID = @userId
            `);
        if (passwordExistsResult.recordset[0].count > 0) {
            // update password if it exists
            await pool.request()
            .input('userId', sql.Int, user.ID)
            .input('password', sql.NVarChar(255), hashedpassword)
            .query(`
                UPDATE credentials SET password = @password 
                WHERE userID = @userId
                `);
        }else{
            // Insert password if one doesn't exist
            await pool.request()
            .input('userId', sql.Int, user.ID)
            .input('password', sql.NVarChar(255), hashedpassword)
            .query(`
                insert into credentials (userID,[password])
                Values(@userId, @password)
                `);
        }
        await pool.request()
        .input('token', sql.NVarChar(255), token)
        .query(`
            DELETE FROM ResetTokens 
            WHERE token = @token
            `);

            req.session.returnTo = resetToken.returnTo

            loginUser(req,res,pool,user.ID)
        // res.redirect(resetToken.returnTo||'/')
    } catch (error) {
        console.error('Error resetting password:', error);
    }
  });
router.get('/', async (req,res, next)=>{
    try{
        console.log(req.user)
        
    }catch(err){
        next(err)
    }
});



// Export the router so it can be used in other files
module.exports = router;
