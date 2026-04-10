const db = require('./db');

/**
 * Script de migración exhaustivo para asegurar compatibilidad total.
 */
async function runMigrations() {
  console.log('--- INICIANDO MIGRACIÓN INTEGRAL DE BASE DE DATOS ---');
  
  const ALLOWED_TABLES = [
    'profiles', 'settings', 'news', 'changelog', 'forum', 'comments',
    'saved_codes', 'saved_notes', 'feedback', 'grading_configs', 'events',
    'call_logs', 'attendance', 'content_reads', 'presence', 'typing',
    'messages', 'activities', 'submissions', 'materials', 'notifications', 'groups'
  ];

  for (const table of ALLOWED_TABLES) {
    try {
      // 1. Asegurar created_at y updated_at en TODAS las tablas
      await db.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
      await db.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    } catch (err) {
      // Ignorar si la tabla no existe aún o si ya tiene las columnas
    }
  }

  const specificMigrations = [
    // Noticias
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}'`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0`,

    // Foro
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}'`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`,
    `ALTER TABLE forum ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0`,

    // Comentarios
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_type TEXT`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_photo TEXT`,
    `ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_id UUID`,

    // Feedback
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_name TEXT`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_photo TEXT`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}'`,

    // Eventos
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ`,
    
    // Configuraciones
    `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS teacher_id UUID`,
    `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS weights JSONB DEFAULT '{}'`,

    // Actividades - Corregir tipo de dato a TEXT para aceptar 'auto'
    `ALTER TABLE activities ALTER COLUMN manual_access TYPE TEXT USING manual_access::text`
  ];

  for (const query of specificMigrations) {
    try {
      await db.query(query);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.error('Error en migración específica:', err.message);
      }
    }
  }

  console.log('--- MIGRACIÓN INTEGRAL COMPLETADA ---');
}

module.exports = runMigrations;
