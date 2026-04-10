-- 1. SINCRONIZACIÓN DE COLUMNAS FALTANTES

-- Añadir updated_at a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Añadir type a submissions (útil para distinguir entre archivos, texto, etc)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'archivo';

-- Añadir campos de organización al foro
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.forum ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 2. CORRECCIÓN DE RLS (Row-Level Security)

-- Permitir que los usuarios inserten su propio perfil (necesario para upsert)
DROP POLICY IF EXISTS "Users can insert own profile." ON public.profiles;
CREATE POLICY "Users can insert own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Asegurar que todos puedan ver los perfiles para que el chat y foro funcionen
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

-- Permitir actualización propia
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. HABILITAR PERMISOS PARA SETTINGS (Para el modo mantenimiento)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Settings are viewable by everyone." ON public.settings;
CREATE POLICY "Settings are viewable by everyone." ON public.settings FOR SELECT USING (true);
