-- ESQUEMA DE EMERGENCIA: SINCRONIZACIÓN TOTAL
-- 1. Añadir columnas críticas a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_setup BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_valid BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 2. Crear tablas faltantes que están dando 404
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB
);
INSERT INTO public.settings (key, value) VALUES ('global', '{"maintenanceMode": false}'::jsonb) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    stars INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.changelog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version TEXT,
    title TEXT,
    description TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Actualizar el trigger de registro inteligente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, is_setup, session_valid, is_banned)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
    CASE 
      WHEN new.email = 'developer@tdsc.isgosk.com' THEN 'profesor'
      WHEN new.email = 'admin@tdsc.isgosk.com' THEN 'profesor' 
      ELSE 'estudiante'
    END,
    FALSE, -- Para que salga el formulario de bienvenida
    TRUE,
    FALSE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Resetear el estado para el desarrollador para que pueda probarlo
UPDATE public.profiles SET is_setup = false WHERE email = 'developer@tdsc.isgosk.com';
UPDATE public.profiles SET is_setup = false WHERE email = 'calaberakilerator.127@gmail.com';
