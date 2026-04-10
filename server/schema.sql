-- ESQUEMA DE BASE DE DATOS PARA APRENDE PYTHON (INDIE BACKEND)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Usuarios e Identidad (Reemplazo de auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Nulo para usuarios de Google
    google_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Perfiles de Usuario
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    photo_url TEXT,
    role TEXT DEFAULT 'estudiante', -- 'estudiante', 'profesor', 'admin', 'developer'
    status TEXT DEFAULT 'activo',
    is_setup BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    session_valid BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    blocked_users UUID[] DEFAULT '{}',
    pinned_chats TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Actividades y Tareas
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    points INTEGER DEFAULT 100,
    scale TEXT DEFAULT 'numerica',
    type TEXT DEFAULT 'tarea', -- 'tarea', 'examen', 'foro'
    eval_method TEXT DEFAULT 'manual',
    author_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'abierto',
    assigned_to TEXT DEFAULT 'all', -- 'all' o lista de IDs
    rubric JSONB DEFAULT '{}',
    questions JSONB DEFAULT '[]',
    time_limit INTEGER,
    password TEXT,
    manual_access TEXT DEFAULT 'false'
);

-- 4. Entregas (Submissions)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'entregado', -- 'entregado', 'calificado', 'corregido'
    grade DECIMAL(5,2),
    type TEXT,
    content JSONB DEFAULT '{}', -- Texto, Código, Respuestas de Quiz
    html_content TEXT, -- Contenido enriquecido
    teacher_feedback TEXT,
    rubric_scores JSONB DEFAULT '{}',
    attachments JSONB[] DEFAULT '{}',
    graded_by UUID REFERENCES users(id),
    graded_at TIMESTAMPTZ
);

-- 5. Materiales de Estudio
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    type TEXT, -- 'pdf', 'video', 'link'
    content_type TEXT, -- Alias para el frontend
    author_id UUID REFERENCES users(id)
);

-- 6. Mensajes y Chat
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_at_iso TEXT,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_name TEXT,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL para chat grupal/general
    chat_id TEXT NOT NULL, -- 'general' o ID de grupo o 'private_UID1_UID2'
    text TEXT,
    type TEXT DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    attached_file JSONB DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Grupos
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    members UUID[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    permissions JSONB DEFAULT '{}'
);

-- 8. Notificaciones
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    author_id UUID REFERENCES users(id),
    author_name TEXT,
    message TEXT NOT NULL,
    target_user_ids UUID[] DEFAULT NULL, -- NULL para todos
    type TEXT,
    target_id UUID,
    is_read BOOLEAN DEFAULT FALSE
);

-- 9. Configuraciones Globales
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- 10. Eventos (Calendario)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    start_date TIMESTAMPTZ, -- Alias para compatibilidad
    end_date TIMESTAMPTZ, -- Alias para compatibilidad
    color TEXT,
    author_id UUID REFERENCES users(id),
    assigned_to UUID[] DEFAULT '{}',
    status TEXT DEFAULT 'activa',
    link TEXT,
    category TEXT DEFAULT 'normal',
    is_priority BOOLEAN DEFAULT FALSE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE
);

-- 11. Logs de Llamadas y Asistencia
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    chat_id TEXT NOT NULL,
    caller_id UUID REFERENCES users(id),
    duration INTEGER, -- en segundos
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    is_present BOOLEAN DEFAULT TRUE,
    marked_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'presente'
);

-- 12. Noticias y Changelog
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID REFERENCES users(id),
    category TEXT
);

CREATE TABLE IF NOT EXISTS changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    version TEXT,
    title TEXT NOT NULL,
    description TEXT,
    changes JSONB DEFAULT '[]'
);

-- 13. Foro y Comentarios
CREATE TABLE IF NOT EXISTS forum (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT,
    category TEXT,
    is_pinned BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    target_id UUID NOT NULL, -- ID de post del foro, actividad, etc.
    target_type TEXT NOT NULL, -- 'forum', 'activity', etc.
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT,
    author_photo TEXT,
    text TEXT,
    content TEXT, -- Alias para compatibilidad
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE -- Para respuestas
);

-- 14. Code Lab y Notas
CREATE TABLE IF NOT EXISTS saved_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    code TEXT,
    language TEXT,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT,
    is_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS saved_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT
);

-- 15. Feedback y Configuración de Calificaciones
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    type TEXT, -- 'bug', 'suggestion', etc.
    message TEXT,
    content TEXT, -- Alias para compatibilidad
    status TEXT DEFAULT 'pendiente',
    author_name TEXT,
    author_photo TEXT
);

CREATE TABLE IF NOT EXISTS grading_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    weight DECIMAL(5,2),
    weights JSONB DEFAULT '{}',
    grade_scale DECIMAL(5,2) DEFAULT 10,
    attendance_weight DECIMAL(5,2) DEFAULT 0,
    include_attendance BOOLEAN DEFAULT FALSE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    min_grade DECIMAL(5,2),
    max_grade DECIMAL(5,2),
    UNIQUE(teacher_id)
);

-- 16. Estadísticas y Presencia
CREATE TABLE IF NOT EXISTS content_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'online', -- 'online', 'offline', 'away'
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 17. Typing (Opcional si se usa Sockets volatil, pero podemos persistirlo para debugging)
CREATE TABLE IF NOT EXISTS typing (
    chat_id TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT,
    last_typed BIGINT, -- Timestamp en ms
    PRIMARY KEY (chat_id, user_id)
);

-- Tablas de perfiles y usuarios
-- (Ya existen, solo nos aseguramos de las columnas)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'estudiante';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Noticias
ALTER TABLE news ADD COLUMN IF NOT EXISTS author_id UUID;
ALTER TABLE news ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE news ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';
ALTER TABLE news ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE news ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- Foro
ALTER TABLE forum ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE forum ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE forum ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE forum ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';
ALTER TABLE forum ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE forum ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- Comentarios
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_type TEXT; -- 'news', 'forum', 'activity', etc.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_photo TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_id UUID;

-- Feedback
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS author_photo TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

-- Eventos (Sincronizar campos)
ALTER TABLE events ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ; -- Alias de start_date para compatibilidad
ALTER TABLE events ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Configuraciones de Calificación
ALTER TABLE grading_configs ADD COLUMN IF NOT EXISTS teacher_id UUID;
ALTER TABLE grading_configs ADD CONSTRAINT grading_configs_teacher_id_key UNIQUE (teacher_id);

-- Actividades
ALTER TABLE activities ADD COLUMN IF NOT EXISTS manual_access TEXT DEFAULT 'false'; -- Cambiado a TEXT porque el log muestra que se envía 'auto'
CREATE INDEX IF NOT EXISTS idx_submissions_activity ON submissions(activity_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
