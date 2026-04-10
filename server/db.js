const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.server' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => {
  console.log('API conectada a la base de datos PostgreSQL');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
