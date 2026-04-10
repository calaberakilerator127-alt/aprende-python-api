-- ESQUEMA DE BASE DE DATOS PARA APRENDE PYTHON (INDIE BACKEND)

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
    manual_access BOOLEAN DEFAULT FALSE
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
    feedback TEXT,
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
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    color TEXT,
    author_id UUID REFERENCES users(id),
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
    text TEXT NOT NULL,
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
    is_public BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS saved_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Feedback y Configuración de Calificaciones
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    type TEXT, -- 'bug', 'suggestion', etc.
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pendiente'
);

CREATE TABLE IF NOT EXISTS grading_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    weight DECIMAL(5,2),
    min_grade DECIMAL(5,2),
    max_grade DECIMAL(5,2)
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

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_presence_status ON presence(status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_submissions_activity ON submissions(activity_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
