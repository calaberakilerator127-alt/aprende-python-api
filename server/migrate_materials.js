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
            -- Tabla Materials
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS content TEXT;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS attached_file TEXT;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

            -- Tabla Comments (Cambio a UUID[])
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID;
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_type TEXT;
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name TEXT;
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_photo TEXT;
            
            -- Conversión Segura de likes/dislikes (de INTEGER a UUID[])
            -- Primero eliminamos si existen como integer para evitar conflictos de tipo
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='likes' AND data_type='integer') THEN
                    ALTER TABLE comments DROP COLUMN likes;
                    ALTER TABLE comments DROP COLUMN dislikes;
                END IF;
            END $$;
            
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}';
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS dislikes UUID[] DEFAULT '{}';
            ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_id UUID;

            -- Tabla News
            ALTER TABLE news ADD COLUMN IF NOT EXISTS author_name TEXT;
            ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
            ALTER TABLE news ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';
            
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news' AND column_name='likes' AND data_type='integer') THEN
                    ALTER TABLE news DROP COLUMN likes;
                    ALTER TABLE news DROP COLUMN dislikes;
                END IF;
            END $$;
            
            ALTER TABLE news ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}';
            ALTER TABLE news ADD COLUMN IF NOT EXISTS dislikes UUID[] DEFAULT '{}';
        `);
        console.log('✅ Migración completa y tipos de datos sincronizados.');
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante la migración:', err.message);
        await pool.end();
        process.exit(1);
    }
}

migrate();
