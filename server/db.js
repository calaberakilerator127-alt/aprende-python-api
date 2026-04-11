const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.server' });

const isProduction = process.env.NODE_ENV === 'production';

// Validamos que exista la URL de conexión
if (!process.env.DATABASE_URL) {
  console.error('[DATABASE ERROR] DATABASE_URL no está definida en las variables de entorno.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : (process.env.DATABASE_URL.includes('onrender.com') ? { rejectUnauthorized: false } : false),
  max: 20, // Aumentar conexiones en producción
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('✅ Base de datos conectada correctamente.');
});

pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR] Error inesperado en el pool:', err);
  if (isProduction) {
    // En producción, no queremos que el servidor muera inmediatamente por una desconexión temporal
    console.warn('Reintentando conexión automática del pool...');
  } else {
    process.exit(-1);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool // Exponemos el pool por si necesitamos cerrar conexiones en tests
};

