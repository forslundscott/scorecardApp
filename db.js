const sql = require('mssql');
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    trustServerCertificate: true,
    options: {
        encrypt: true,
        connectionTimeout: 30000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      },
};
const ROLES = {}
const pool = new sql.ConnectionPool(config)
pool.connect().then(async () => {
    console.log('Connected to MSSQL with global connection pool');
    try{
        await roleSetter()
        console.log(ROLES.admin)
    }catch(err){
        console.error('Error:', err)
    }
  })
  .catch((err) => {
    console.error('Error connecting to MSSQL:', err);
  });
  async function roleSetter() {
    try{
        const request = pool.request();
        const result = await request.query(`
        SELECT name, id
        FROM roles
        `);
        result.recordset.forEach(row => {
            ROLES[row.name] = row.id;
        });
    }catch(err){
        console.error('Error:', err)
    }  
};
  module.exports = pool;