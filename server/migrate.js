const db = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * Script de migración robusto que inicializa el esquema y sincroniza columnas faltantes.
 */
async function runMigrations() {
  console.log('--- [MIGRACIÓN] Iniciando proceso de estabilización de Base de Datos ---');
  
  try {
    // 1. Ejecutar schema.sql para asegurar tablas base
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('--- [MIGRACIÓN] Cargando schema.sql ---');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(schemaSql);
      console.log('--- [MIGRACIÓN] schema.sql ejecutado correctamente ---');
    }

    // 2. Parches de Sincronización (Asegurar columnas específicas que el frontend requiere)
    const syncPatches = [
      // Perfiles
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'estudiante'`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_setup BOOLEAN DEFAULT FALSE`,
      
      // Grading Configs (Critico para GradesView)
      `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS weights JSONB DEFAULT '{}'`,
      `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS grade_scale DECIMAL(5,2) DEFAULT 10`,
      `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS attendance_weight DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS include_attendance BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS teacher_id UUID`,

      // Eventos (Critico para Calendario)
      `ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ`,
      `ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ`,
      `ALTER TABLE events ADD COLUMN IF NOT EXISTS assigned_to UUID[] DEFAULT '{}'`,
      `ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'activa'`,

      // Materiales
      `ALTER TABLE materials ADD COLUMN IF NOT EXISTS content_type TEXT`,

      // Saved Codes & Notes
      `ALTER TABLE saved_codes ADD COLUMN IF NOT EXISTS author_name TEXT`,
      `ALTER TABLE saved_notes ADD COLUMN IF NOT EXISTS author_name TEXT`,

      // Feedback & Comentarios
      `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS content TEXT`,
      `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_name TEXT`,
      `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_photo TEXT`,
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS content TEXT`,
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name TEXT`,
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_photo TEXT`,

      // Entregas (Submissions)
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS html_content TEXT`,
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT`,
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS rubric_scores JSONB DEFAULT '{}'`,
      `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachments JSONB[] DEFAULT '{}'`,

      // Actividades
      `ALTER TABLE activities ALTER COLUMN manual_access TYPE TEXT USING manual_access::text`
    ];

    for (const sql of syncPatches) {
      try {
        await db.query(sql);
      } catch (err) {
        // Ignorar errores si la columna ya existe o errores menores
        if (!err.message.includes('already exists')) {
          console.warn(`[MIGRACIÓN] Aviso en parche: ${err.message}`);
        }
      }
    }

    // 3. Asegurar created_at y updated_at en todas las tablas importantes
    const tables = [
      'profiles', 'settings', 'news', 'changelog', 'forum', 'comments',
      'saved_codes', 'saved_notes', 'feedback', 'grading_configs', 'events',
      'call_logs', 'attendance', 'content_reads', 'presence', 'typing',
      'messages', 'activities', 'submissions', 'materials', 'notifications', 'groups'
    ];

    for (const table of tables) {
      try {
        await db.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
        await db.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
      } catch (e) { /* Ignorar si falla por tabla inexistente */ }
    }

    console.log('--- [MIGRACIÓN] Proceso de estabilización completado con éxito ---');
  } catch (err) {
    console.error('--- [MIGRACIÓN] ERROR CRÍTICO:', err.message);
    throw err; // Re-lanzar para que index.js sepa que falló
  }
}

module.exports = runMigrations;
