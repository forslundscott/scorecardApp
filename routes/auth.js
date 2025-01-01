// routes/users.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt')
const passport = require('passport')
const nodemailer = require('nodemailer');
const pool = require(`../db`)
const sql = require('mssql'); 
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/login'], checkNotAuthenticated, async (req,res)=>{
    try{
        console.log(req.session.cookie.returnTo)
        if (req.query.returnTo != undefined) {

            req.session.returnTo = req.query.returnTo;
        }else{

            req.session.returnTo = req.header('Referer')

        }

        res.render('login.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
router.post(['/login'], function(req, res, next) { passport.authenticate('local', function(err, user, info, status) {
    if (err) { return next(err) }
    try{

        if (!user) { return res.render('login.ejs', {messages: info}) }
        req.session.passport = {}
        req.session.passport.user = user.id
        const redirectUrl = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectUrl);
    }catch(err){
        console.error('Error:', err)
    }
})(req, res, next)
})

router.delete('/logout', (req,res) => {
    try{
        if(req.session){
            if(req.session.passport){
                delete req.session.passport
                res.redirect('back')
            }
        }
    }catch(err){
        console.error('Error:', err)
    }    
})
router.get(['/createProfile'], async (req,res)=>{
    try{
        res.render('createProfile.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})

router.post(['/createProfile'], async (req,res)=>{

    try {
        const emailExistsResult = await pool.request()
            .input('email', sql.VarChar, req.body.email)
            .query(`SELECT COUNT(*) AS count FROM users WHERE email = @email`);
        
        // If email already exists, respond with a message

        if (emailExistsResult.recordset[0].count > 0) {
            return res.render('createProfile.ejs', {messages: {message: 'User with specified email already exists, Please use reset Password link.'}})
        }
        const hashedpassword = await bcrypt.hash(req.body.password, 10)
        const request = pool.request()
        const result = await request
        .input('email', sql.VarChar, req.body.email)
        .input('firstName', sql.VarChar, req.body.firstName)
        .input('lastName', sql.VarChar, req.body.lastName)
        .input('password', sql.VarChar, hashedpassword)
        .query(`
            DECLARE @tempTable table (
                id int
            )
            BEGIN TRANSACTION
            insert into users (firstName, lastName, email)
            OUTPUT inserted.id
            into @tempTable
            values (@firstName, @lastName, @email)
            
            insert into credentials (userID,[password])
            select id, @password from @tempTable
            COMMIT`)        
        res.redirect('/auth/login')
    }catch(err){
        console.log(err)
        res.redirect('/auth/createProfile')
    }
    
})
router.get(['/forgotPassword'], async (req,res)=>{
    try{
        res.render('forgotPassword.ejs')
    }catch(err){
        console.error('Error:', err)
    }    
})
router.post(['/forgotPassword'], async (req,res)=>{
    const { email } = req.body;
    const request = pool.request();


  try {
    const result = await request
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

    await request
    .input('id', sql.Int, user.id)
    .input('token', sql.NVarChar(255), token)
    .query(
        `
      INSERT INTO ResetTokens (userId, token) VALUES (@id, @token)
    `
    );

    // Send reset email
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        service: 'gmail',
        secure: false,
        auth: {
           user: process.env.ORG_EMAIL,
           pass: process.env.ORG_EMAIL_PASSWORD
        },
        debug: false,
        logger: true
    });

    const resetLink = `${req.protocol}://${req.headers.host}/auth/reset/${token}`;
    const mailOptions = {
      from: process.env.ORG_EMAIL,
      to: user.email,
      subject: 'Password Reset',
      text: `Click the following link to reset your password: ${resetLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error('Error sending reset email:', error);
      }
      console.log('Reset email sent:', info.response);
      return res.redirect('/')

    });
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
        res.render('resetPassword.ejs')
    }catch(err){
        console.error('Error:', err)
    }
})

router.post('/reset/:token', async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('resetPassword.ejs', { messages: {error: 'Passwords do not match'} })
        }
        // Use MSSQL to find reset token in the database
        const request = pool.request();  
    
        const result = await request
        .input('token', sql.NVarChar(255), token)
        .query(`SELECT * FROM ResetTokens WHERE token = @token`);
        const resetToken = result.recordset[0];
    
        if (!resetToken) {
            return res.status(404).json({ message: 'Invalid token' });
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
        .query(`SELECT COUNT(*) AS count FROM credentials WHERE userID = @userId`);
        // const updateUserQuery = ''
        if (passwordExistsResult.recordset[0].count > 0) {
            // update password if it exists
            await pool.request()
            .input('userId', sql.Int, user.ID)
            .input('password', sql.NVarChar(255), hashedpassword)
            .query(`UPDATE credentials SET password = @password WHERE userID = @userId`);
            // updateUserQuery = `UPDATE credentials SET password = '${hashedpassword}' WHERE userID = ${user.ID}`;
        }else{
            // Insert password if one doesn't exist
            await pool.request()
            .input('userId', sql.Int, user.ID)
            .input('password', sql.NVarChar(255), hashedpassword)
            .query(`insert into credentials (userID,[password])
            Values(@userId, @password)`);
        }
        await pool.request()
        .input('token', sql.NVarChar(255), token)
        .query(`DELETE FROM ResetTokens WHERE token = @token`);
        res.redirect('/')
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
