const { Parser } = require('json2csv');
const Color = require('color');
const pool = require(`../db`)
const sql = require('mssql'); 
// import { flatten } from 'flat'
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
const fileNameSanitizer = (fileName) => {
    try{
        fileName = fileName.replace(/[^a-z0-9_-]/gi, '')
        fileName = fileName.slice(0,251) + '.csv'
        return fileName
    }catch(err){
        return 'export.csv'
    }
}
module.exports = {titleCase,getOrdinalNumber,exportToCSV,getHexColor,millisecondsToTimeString,addUserToDatabase,getUser,formatDate,fileNameSanitizer}