const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.server' });

async function migrate() {
    console.log('--- INICIANDO MIGRACIÓN DE TABLA MATERIALS ---');
    
    // Si DATABASE_URL usa 'db' (Docker), intentamos cambiar a 'localhost' para ejecución local
    let connectionString = process.env.DATABASE_URL;
    if (connectionString.includes('@db:')) {
        console.log('🔄 Detectado hostname de Docker "db". Probando con "localhost"...');
        connectionString = connectionString.replace('@db:', '@localhost:');
    }

    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('onrender.com') ? { rejectUnauthorized: false } : false
    });

    try {
        await pool.query(`
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS content TEXT;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS attached_file TEXT;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        `);
        console.log('✅ Migración completada exitosamente.');
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante la migración:', err.message);
        await pool.end();
        process.exit(1);
    }
}

migrate();
