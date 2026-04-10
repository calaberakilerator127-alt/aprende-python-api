-- MEGA MIGRACIÓN DE REPARACIÓN DE ESQUEMA Y PERSISTENCIA

-- 1. REPARACIÓN TABLA FORO (FORUM)
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'académico';
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS likes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS dislikes JSONB DEFAULT '[]'::jsonb;

-- 2. REPARACIÓN TABLA NOTICIAS (NEWS)
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS likes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS dislikes JSONB DEFAULT '[]'::jsonb;

-- 3. REPARACIÓN TABLA PERFILES (PROFILES)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_setup BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. REPARACIÓN TABLA ENTREGAS (SUBMISSIONS)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'archivo';

-- 5. RE-INSTALACIÓN DE POLÍTICAS RLS (Garantiza lectura y escritura)

-- Permitir INSERT en perfiles (para el primer registro)
DROP POLICY IF EXISTS "Permitir creación de perfil propio" ON public.profiles;
CREATE POLICY "Permitir creación de perfil propio" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas globales de lectura (Para que no desaparezcan datos al recargar)
DO $$ 
BEGIN
    -- Forum
    DROP POLICY IF EXISTS "Lectura foro" ON public.forum;
    CREATE POLICY "Lectura foro" ON public.forum FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Inserción foro" ON public.forum;
    CREATE POLICY "Inserción foro" ON public.forum FOR INSERT WITH CHECK (auth.uid() = author_id);
    
    -- Mensajes
    DROP POLICY IF EXISTS "Lectura mensajes" ON public.messages;
    CREATE POLICY "Lectura mensajes" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
    DROP POLICY IF EXISTS "Inserción mensajes" ON public.messages;
    CREATE POLICY "Inserción mensajes" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

    -- News
    DROP POLICY IF EXISTS "Lectura news" ON public.news;
    CREATE POLICY "Lectura news" ON public.news FOR SELECT USING (true);
END $$;
