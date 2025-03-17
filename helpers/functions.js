const { Parser } = require('json2csv');
const Color = require('color');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
// const ClamScan = require('clamscan');
const sanitizeFilename = require('sanitize-filename')
const pool = require(`../db`)
const sql = require('mssql'); 
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
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
async function createCheckoutSession({ metadata }) {
    try {
        
        // console.log(await stripe.prices.list({ active: true }))
        const product = await stripe.products.search({
            query: `name:'6 Game Season'`,
        })
        console.log(product.data[0].default_price)
        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price: metadata.priceId,
                    quantity: metadata.quantity,
                },
            ],
            customer_email: metadata.email,
            mode: 'payment',
            metadata: metadata,
            success_url: metadata.success_url,
            cancel_url: metadata.cancel_url,
        });
  
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
    const result = await pool.request()
        .input('abbreviation', sql.VarChar, data.abbreviation)
        .input('fullName', sql.VarChar, data.fullName)
        .input('shortName', sql.VarChar, data.shortName)
        .input('leagueId', sql.VarChar, data.leagueId)
        .input('seasonId', sql.Int, data.seasonId)
        .input('color', sql.VarChar, data.color)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM teams WHERE id = @abbreviation)
            BEGIN
                DECLARE @teamId INT;

                INSERT INTO teams (id, fullName, shortName, leagueId, seasonId, abbreviation, color)
                VALUES (@abbreviation, @fullName, @shortName, @leagueId, @seasonId, @abbreviation, @color);

                SET @teamId = SCOPE_IDENTITY();

                insert into seasonLeagueTeam (seasonId, leagueId, teamId)
                values(@seasonId,@leagueId,@teamId);

            END
            select @teamId as teamId
            `)
            return result.recordset[0].teamId
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
    ,addTeamLogo
}