const db = require('./db');

/**
 * Script de migración automática para sincronizar el esquema de DB en Render
 * (Especialmente útil si no tienes acceso al Shell de Render)
 */
async function runMigrations() {
  console.log('--- INICIANDO MIGRACIÓN DE BASE DE DATOS ---');
  
  const migrationQueries = [
    // Perfiles y Settings
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'estudiante'`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    // Noticias
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS author_id UUID`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}'`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0`,

    // Foro
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}'`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0`,

    // Comentarios
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_type TEXT`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_photo TEXT`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_id UUID`,

    // Feedback
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS title TEXT`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_photo TEXT`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}'`,

    // Eventos y Calificaciones
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS type TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
    `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS teacher_id UUID`,

    // Actividades - Corregir tipo de dato
    `ALTER TABLE activities ALTER COLUMN manual_access TYPE TEXT USING manual_access::text`
  ];

  for (const query of migrationQueries) {
    try {
      await db.query(query);
      // console.log('Éxito:', query.substring(0, 50) + '...');
    } catch (err) {
      // Ignorar errores de columnas ya existentes
      if (!err.message.includes('already exists')) {
        console.error('Error en migración:', err.message);
      }
    }
  }

  console.log('--- MIGRACIÓN COMPLETADA CON ÉXITO ---');
}

module.exports = runMigrations;
