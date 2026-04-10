-- ESQUEMA INICIAL DE APRENDE PYTHON (MIGRACIÓN DESDE FIREBASE)

-- 1. PERFILES DE USUARIO
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT CHECK (role IN ('profesor', 'estudiante', 'admin', 'developer')) DEFAULT 'estudiante',
  status TEXT DEFAULT 'activo',
  photo_url TEXT,
  last_seen BIGINT,
  is_banned BOOLEAN DEFAULT false,
  session_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ACTIVIDADES (TAREAS Y EVALUACIONES)
CREATE TABLE public.activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  points INTEGER DEFAULT 10,
  type TEXT CHECK (type IN ('tarea', 'evaluacion')) DEFAULT 'tarea',
  eval_method TEXT DEFAULT 'archivo',
  author_id UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'abierto',
  assigned_to JSONB DEFAULT '["all"]'::jsonb,
  questions JSONB DEFAULT '[]'::jsonb,
  time_limit INTEGER DEFAULT 0,
  password TEXT,
  manual_access TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ENTREGAS (SUBMISSIONS)
CREATE TABLE public.submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT,
  text TEXT,
  html_content TEXT,
  link TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  comment TEXT,
  status TEXT DEFAULT 'entregado',
  submitted_at BIGINT,
  last_edited_at BIGINT,
  grade NUMERIC(4,2),
  graded_at BIGINT,
  graded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. EVENTOS Y ASISTENCIA
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  type TEXT,
  status TEXT DEFAULT 'programada',
  assigned_to JSONB DEFAULT '["all"]'::jsonb,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_present BOOLEAN DEFAULT true,
  timestamp BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CHAT Y MENSAJES
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT,
  sender_id UUID REFERENCES public.profiles(id),
  sender_name TEXT,
  recipient_id UUID REFERENCES public.profiles(id),
  text TEXT,
  type TEXT DEFAULT 'text',
  is_read BOOLEAN DEFAULT false,
  created_at BIGINT
);

-- 6. MATERIALES, NOTICIAS Y FORO
CREATE TABLE public.materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  description TEXT,
  url TEXT,
  type TEXT,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.forum (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID, -- Referencia a news_id o forum_id
  content TEXT,
  author_id UUID REFERENCES public.profiles(id),
  author_name TEXT,
  created_at BIGINT
);

-- 7. NOTIFICACIONES
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT,
  type TEXT,
  target_id UUID,
  author_id UUID,
  author_name TEXT,
  target_user_ids JSONB,
  created_at BIGINT
);

-- 8. SETTINGS GLOBALES
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB
);

INSERT INTO public.settings (key, value) VALUES ('global', '{"maintenanceMode": false}'::jsonb);

CREATE TABLE public.call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID REFERENCES public.profiles(id),
  receiver_id UUID REFERENCES public.profiles(id),
  type TEXT,
  status TEXT,
  duration INTEGER,
  created_at BIGINT
);

CREATE TABLE public.saved_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  code TEXT,
  language TEXT,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.saved_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TRIGGERS Y FUNCIONES

-- Función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'estudiante')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 10. SEGURIDAD RLS (Permisos básicos)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_notes ENABLE ROW LEVEL SECURITY;

-- Políticas de Perfiles (Lectura para todos, Edición propia)
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas de Actividades (Lectura para todos, Escritura solo profesores)
CREATE POLICY "Activities are viewable by everyone authenticated." ON public.activities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can manage activities." ON public.activities FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- Políticas de Entregas (Alumnos ven las suyas, Profesores ven todas)
CREATE POLICY "Students can view own submissions." ON public.submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view all submissions." ON public.submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);
CREATE POLICY "Students can create submissions." ON public.submissions FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 11. HABILITAR REALTIME
-- Nota: En Supabase, para que Realtime funcione con RLS, las tablas deben estar en la publicación 'supabase_realtime'
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
