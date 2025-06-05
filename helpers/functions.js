const { Parser } = require('json2csv');
const Color = require('color');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
// const ClamScan = require('clamscan');
const sanitizeFilename = require('sanitize-filename')
const pool = require(`../db`)
const sql = require('mssql'); 
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

let teamTransaction
let isTeamTransactionActive = false
// import { flatten } from 'flat'
// const clam = new ClamScan({
//     clamdscan: {
//         socket: '/var/run/clamd/clamd.sock', // Update with actual socket path
//     },
//     debug_mode: false,
//     remove_infected: false, 
// });

function titleCase(str){
    try{
        let words = str.split(' ')
        for(let i=0;i<words.length;i++){
            words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase()
        }
        return words.join(' ')
    }catch(err){
        console.log(err)
    }
}
function getOrdinalNumber(number) {
    try{
        // Convert the input to a number if it's a string
        const num = typeof number === 'string' ? parseInt(number, 10) : number;

        if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
            return 'Invalid input';
        }

        if (num === 0) {
            return '0th';
        }

        const lastDigit = num % 10;
        const secondLastDigit = Math.floor((num % 100) / 10);

        if (secondLastDigit === 1) {
            return num + 'th';
        }

        switch (lastDigit) {
            case 1:
                return num + 'st';
            case 2:
                return num + 'nd';
            case 3:
                return num + 'rd';
            default:
                return num + 'th';
        }
    }catch(err){
        console.log(err)
    }
}
async function exportToCSV(sqlRecordset) {
    try {
    const { flatten } = await import('flat')
      // Convert query result to CSV format
      const parser = new Parser();
      const csv = parser.parse(sqlRecordset.map(item => flatten(item))).replace(/"/g, '');
      return csv;
    } catch (error) {
      throw error;
    }
  }
function getHexColor(colorName) {
    try {
        return Color(colorName).hex(); // Converts color name to hex
    } catch (e) {
        return null; // Return null if the color name is invalid
    }
}
function millisecondsToTimeString(milliseconds) {
    try{
        if (milliseconds < 0 || milliseconds >= 86400000) {
            throw new Error("Milliseconds must be between 0 and 86399999.");
        }

        const totalMinutes = Math.floor(milliseconds / 60000); // Convert to total minutes
        const hours24 = Math.floor(totalMinutes / 60); // Extract hours (24-hour format)
        const minutes = totalMinutes % 60; // Extract remaining minutes

        // Convert 24-hour format to 12-hour format and determine AM/PM
        const period = hours24 >= 12 ? "pm" : "am";
        const hours12 = hours24 % 12 || 12; // Convert to 12-hour format (0 becomes 12)

        // Format the result as a time string
        return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`;
    }catch(err){
        console.log(err)
    }
}
const addUserToDatabase = async (userData) => {
    try{
        const request = pool.request();
    const { firstName, lastName, email } = userData;
        // console.log(userData)
    // Use preferredName if it exists; fallback to firstName otherwise
    const nameToUse = userData?.preferredName?.trim() || firstName;
    await request.input('firstName', sql.VarChar, firstName)
        .input('lastName', sql.VarChar, lastName)
        .input('preferredName', sql.VarChar, nameToUse)
        .input('email', sql.VarChar, email)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM users WHERE email = @email)
            BEGIN
                INSERT INTO users (firstName, lastName, preferredName, email)
                VALUES (@firstName, @lastName, @preferredName, @email)
            END
        `);
    }catch(err){
        console.log(err)
    }
};
const getUser = async (userData) => {
    try{
    const {email } = userData;
    const result = await pool.request()
    .input('email', sql.VarChar, email)
    .query(`
            SELECT * from users
            where email = @email
        `);
    return result.recordset[0]
    }catch(err){
        console.log(err)
        throw err
    }
};
const formatDate = (timestamp) => {
    try{
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) == 'Invalid Date' ? undefined : date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    }catch(err){
        return undefined
    }
  };
//   change to using sanitize-filename
const fileNameSanitizer = (fileName) => {
    try{
        fileName = fileName.replace(/[^a-z0-9_-]/gi, '')
        fileName = fileName.slice(0,251) + '.csv'
        return fileName
    }catch(err){
        return 'export.csv'
    }
}
async function pngUpload (fileBuffer, filename, outputDir) {


    // verify file type
    const metadata = await sharp(fileBuffer).metadata();
    if (metadata.format !== 'png') {
        throw new Error('File is not a valid PNG image');
    }

    // Resize image
    const processedImage = await sharp(fileBuffer)
    .resize(800, 800, { fit: sharp.fit.inside, withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer();

    // Save image
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    const outputPath = path.join(outputDir, sanitizeFilename(filename));
    fs.writeFileSync(outputPath, processedImage, { mode: 0o644 });
    return outputPath //for debugging
}
async function createCheckoutSession({ metadata },discount) {
    try {
        const sessionData = {
            line_items: metadata.lineItems,
            customer_email: metadata.metadata.email,
            mode: 'payment',
            metadata: metadata.metadata,
            success_url: metadata.success_url,
            cancel_url: metadata.cancel_url,
        };
    
        // Only add discounts if there's a valid value
        if (discount && discount.length > 0) {
            sessionData.discounts = [...discount];
        }
    
        const session = await stripe.checkout.sessions.create(sessionData);
        return session;
    } catch (error) {
        // failedQuery(metadata,error)
        throw new Error(error.message);
    }
  }
async function failedQuery(data,errorMessage) {
    console.log('test')
    const filePath = path.join(process.cwd(), "failed_inserts.json");
    console.log(filePath)
    const failedEntry = {
        timestamp: new Date().toISOString(),
        data,
        error_message: errorMessage,
      };
    
      let failedData = [];
      if (fs.existsSync(filePath)) {
        try {
          const rawData = fs.readFileSync(filePath);
          failedData = JSON.parse(rawData);
        } catch (fileError) {
          console.error("Error reading failed inserts file:", fileError);
        }
      }
    
      failedData.push(failedEntry);
    
      try {
        fs.writeFileSync(filePath, JSON.stringify(failedData, null, 2));
      } catch (fileError) {
        console.error("Error writing to failed inserts file:", fileError);
      }
}

async function addTeam(data){
    try{
        console.log(`test team transaction: ${data.fullName}`)
        const result = await pool.request()
                .input('abbreviation', sql.VarChar, data.abbreviation || data.teamAbbreviation)
                .input('fullName', sql.VarChar, data.fullName || data.teamFullName)
                .input('shortName', sql.VarChar, data.shortName || data.teamShortName)
                .input('leagueId', sql.VarChar, data.leagueId)
                .input('seasonId', sql.Int, data.seasonId)
                .input('color', sql.VarChar, data.color || data.teamShirtColor1)
                .input('captain', sql.VarChar, data.captainId?.toString() || null)
                .input('keeper', sql.VarChar, data.keeperId?.toString() || null)
                .input('status', sql.VarChar, 'pending')
                .query(`
                    DECLARE @teamId INT;

                    INSERT INTO teams (fullName, shortName, leagueId, seasonId, abbreviation, color, keeper, captain, status)
                    VALUES (@fullName, @shortName, @leagueId, @seasonId, @abbreviation, @color, @keeper, @captain, @status);

                    SET @teamId = SCOPE_IDENTITY();

                    SELECT @teamId AS teamId;
                `);

            return result.recordset[0].teamId;
        }catch(err){
            rollBackTeam()
            console.log(err)
        }
}
async function assignTeam(seasonId,leagueId,teamId,status = 'active'){
    try{
        
        const result = await pool.request()
                .input('seasonId', sql.Int, seasonId)
                .input('leagueId', sql.Int, leagueId)
                .input('teamId', sql.Int, teamId)
                .input('status', sql.VarChar, status)
                .query(`
                    INSERT INTO seasonLeagueTeam (seasonId, leagueId, teamId, status)
                    VALUES (@seasonId, @leagueId, @teamId, @status);

                    SELECT @teamId AS teamId;
                `);

            return result.recordset[0].teamId;
        }catch(err){
            rollBackTeam()
            console.log(err)
        }
}
async function commitTeam(teamId) {
    try {
        await pool.request()
            .input('teamId', sql.Int, teamId)
            .query(`
                UPDATE teams
                SET status = 'active'
                WHERE teamId = @teamId;

                UPDATE seasonLeagueTeam
                SET status = 'active'
                WHERE teamId = @teamId;
                `);
    } catch (err) {
        console.error('Error finalizing team:', err);
        throw err;
    }
}

async function rollBackTeam() {
    if (teamTransaction && isTeamTransactionActive) {
        await teamTransaction.rollback();
        teamTransaction = null;
    }
}

async function addTeamLogo(logo, teamId) {
    if(teamId){
        const outputDir = path.join(__dirname, '../public/images');
        const filename = `${teamId}.png`;
        if(logo && logo.buffer) {
            await pngUpload(logo.buffer, filename, outputDir)
        }
    }
}

async function updateUserInfo(user){
    let testuser = {
        userId: '1'
    }
    if (!user.userId) return; // Don't run if userId is missing
    console.log('test return')
    const request = pool.request();
    request.input('userId', sql.Int, user.userId);

    const fields = [];
    const paramMap = {
        firstName: sql.VarChar,
        lastName: sql.VarChar,
        preferredName: sql.VarChar,
        email: sql.VarChar,
        phone: sql.VarChar(20),
        dob: sql.BigInt,
        gender: sql.VarChar,
        skill: sql.Int,
        discounted: sql.Bit,
        shirtSize: sql.VarChar,
        emergencyContactFirstName: sql.VarChar,
        emergencyContactLastName: sql.VarChar,
        emergencyContactPhone: sql.VarChar(20),
        emergencyContactRelationship: sql.VarChar,
        allergies: sql.VarChar,
        medicalConditions: sql.VarChar,
        waiverDate: sql.BigInt,
        waiverPayDate: sql.BigInt,
        banned: sql.Bit
    };

    for (const key in paramMap) {
        if (user[key] !== undefined && user[key] !== null) {
            let value = user[key];

            // Special handling for `dob` and `discounted`
            if (key === 'dob') value = new Date(value).getTime();
            if (key === 'discounted') value = ['true', true, 1].includes(value) ? 1 : 0;

            request.input(key, paramMap[key], value);
            fields.push(`${key} = @${key}`);
        }
    }
    // console.log(fields)
    if (fields.length === 0) return; // If no valid fields, don't run query
    // console.log(`UPDATE users SET ${fields.join(', ')} WHERE ID = @userId`)
    const query = `UPDATE users SET ${fields.join(', ')} WHERE ID = @userId`;

    await request.query(query);
}
function getWaiverResetDate() {
    const now = new Date();
    let year = now.getUTCFullYear();

    // If today is before March 1st, get the previous year's March 1st
    if (now.getUTCMonth() < 2) {
        year--;
    }

    const lastMarchFirst = new Date(Date.UTC(year, 2, 1, 0, 0, 0)); // March 1st, 00:00:00 UTC
    const offsetMinutes = lastMarchFirst.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })
        .includes('EST') ? 300 : 240; // EST = 300 min (5 hours), EDT = 240 min (4 hours)

    // Convert to Unix timestamp
    return Math.floor((lastMarchFirst.getTime() + offsetMinutes * 60 * 1000));
    
}
async function checkWaiverFeeDue(userId) {
    let result = await pool.request()
    .input('userId',sql.Int,userId)
    .query(`
        select waiverPayDate
        from users
        where ID = @userId
        `
    )
    // console.log(result.recordset)
    // return true
    return result.recordset[0].waiverPayDate < getWaiverResetDate()
}
async function sendEmail(body, toEmail , fromText, subject){
      try {    
        // Send reset email
        const transporter = nodemailer.createTransport({
            // host: 'smtp.gmail.com',
            // port: 587,
            service: 'gmail',
            // secure: true,
            auth: {
               user: process.env.ORG_EMAIL,
               pass: process.env.ORG_EMAIL_PASSWORD
            },
            debug: false,
            logger: true
        });
        const isHTML = /<\/?[a-z][\s\S]*>/i.test(body);
        const mailOptions = {
          from: `${fromText} <${process.env.ORG_EMAIL}>`,
          to: toEmail,
          subject: subject,
          ...(isHTML ? { html: body } : { text: body }),
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.error('Error sending reset email:', error);
          }
          return res.redirect('/')
    
        });
      } catch (error) {
        console.error('Error sending email:', error);
      } 
   
}
async function newRegistrationEmail(sessionId){
    try {    
      // Send reset email
      let result = await pool.request()
            .input('testMode', sql.Bit, stripe._authenticator._apiKey.startsWith('sk_test_')?1:0)
            .input('transactionId', sql.VarChar, sessionId)
            .query(`select top 1 u.firstName + ' ' + u.lastName as fullName,
                 u.email
                 , sr.type
                 , sr.registrationId
                 , sr.transactionId
                 , sr.gateway from seasonRegistrations as sr
                left join users as u on sr.userId=u.ID
                where sr.test = @testMode
                and transactionId = @transactionId
                `)
        let session
        console.log(result.recordset)
        let htmlString = ''
        let htmlString2 = ''
        let totalPrice = 0
        let registration = result.recordset[0]
        // for(let registration of result.recordset){
            session = await stripe.checkout.sessions.retrieve(registration.transactionId)
            let registrationPrice = new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(session.amount_total/100)
            totalPrice = totalPrice + (session.amount_total/100)
            htmlString += `<tr>
                <td>${registration.fullName}</td>
                <td>${registration.email}</td>
                <td>${registration.type}</td>
                <td>${registrationPrice}</td>
                <td>${registration.registrationId}</td>
            </tr>`
        // }
        result = await pool.request()
            .input('testMode', sql.Bit, stripe._authenticator._apiKey.startsWith('sk_test_')?1:0)
            .input('registrationId', sql.Int, result.recordset[0].registrationId)
            .query(`
                    select u.firstName + ' ' + u.lastName as fullName
                    , u.email
                    , l.shortName as leagueShortName
                    , t.shortName as teamShortName
                    , sr.division
                    , sr.keeper
                    , sr.shirtSize
                    , sr.registrationId
                     from seasonRegistration_leagueTeam as sr
                    left join users as u on sr.userId=u.ID
                    LEFT join leagues as l on sr.leagueId=l.leagueId
                    left join teams as t on sr.teamId=t.teamId
                    where sr.test = @testMode
                    and registrationId = @registrationId
                `)

                for(let registration of result.recordset){
                    htmlString2 += `<tr>
                        <td>${registration.fullName}</td>
                        <td>${registration.email}</td>
                        <td>${registration.leagueShortName}</td>
                        <td>${registration.teamShortName}</td>
                        <td>${registration.division}</td>
                        <td>${registration.keeper}</td>
                        <td>${registration.shirtSize}</td>
                        <td>${registration.registrationId}</td>
                    </tr>`
                }
            let htmlBody = `
            <h2>Registration Payments:</h2>
            <table border="1" cellspacing="0" cellpadding="5">
                <thead>
                    <td>Name</td>
                    <td>Email</td>
                    <td>Registration Type</td>
                    <td>Amount</td>
                    <td>Registration Id</td>
                </thead>
                <tbody>
                    ${htmlString}
                </tbody>
                <tfoot>
                    <tr>
                        <td><strong>Total</strong></td>
                        <td><strong></strong></td>
                        <td><strong></strong></td>
                        <td id="total"><strong>${new Intl.NumberFormat('en-US', { 
                            style: 'currency', 
                            currency: 'USD' 
                        }).format(totalPrice)}</strong></td>
                        <td><strong></strong></td>
                    </tr>
                </tfoot>
            </table>
            <h2>Registration Details:</h2>
            <table border="1" cellspacing="0" cellpadding="5">
                <thead>
                    <td>Name</td>
                    <td>Email</td>
                    <td>League</td>
                    <td>Team</td>
                    <td>Division</td>
                    <td>Keeper?</td>
                    <td>Shirt Size</td>
                    <td>Registration Id</td>
                </thead>
                <tbody>
                    ${htmlString2}
                </tbody>
            </table>
            `
            sendEmail(htmlBody,process.env.PICKUP_ALERT_EMAIL,'noReplyGlos', 'New Registration')
    } catch (error) {
      console.error('Error sending email:', error);
    } 
 
}
async function waiverSignedEmail(user){
    try {    
          
            let htmlBody = `
            <h2>Waiver Signed By:</h2>
            <p>${user.firstName} ${user.lastName} ${user.email}</p>
            `
            sendEmail(htmlBody,process.env.PICKUP_ALERT_EMAIL,'noReplyGlos', 'Waiver Signed')
    } catch (error) {
      console.error('Error sending email:', error);
    } 
 
}
function getDayName(dayNumber) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber % 7];
}
module.exports = {
    titleCase
    ,getOrdinalNumber
    ,exportToCSV
    ,getHexColor
    ,millisecondsToTimeString
    ,addUserToDatabase
    ,getUser
    ,formatDate
    ,fileNameSanitizer
    ,pngUpload
    ,createCheckoutSession
    ,failedQuery
    ,addTeam
    ,assignTeam
    ,addTeamLogo
    ,updateUserInfo
    ,getWaiverResetDate
    ,checkWaiverFeeDue
    ,commitTeam
    ,rollBackTeam
    ,sendEmail
    ,newRegistrationEmail
    ,waiverSignedEmail
    ,getDayName
}