const db = require('./db');

async function migrate() {
  console.log('🚀 Starting schema alignment migration...');
  
  try {
    // 1. Feedback Table
    console.log('--- Updating feedback table ---');
    await db.query(`
      ALTER TABLE feedback 
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'
    `);

    // 2. Forum Table
    console.log('--- Updating forum table ---');
    await db.query(`
      ALTER TABLE forum 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);

    // 3. Profiles Table (Ensure everything for auth)
    console.log('--- Updating profiles table ---');
    await db.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS session_valid BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE
    `);

    // 4. Materials Table
    console.log('--- Updating materials table ---');
    await db.query(`
      ALTER TABLE materials 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
