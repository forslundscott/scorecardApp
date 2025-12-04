const sql = require('mssql');
let pool
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
async function getPool() {
  if (pool) return pool;
  pool = new sql.ConnectionPool(config);
  await pool.connect();
  console.log("MSSQL connected");

  return pool;
}
getPool()
module.exports = { getPool, pool };