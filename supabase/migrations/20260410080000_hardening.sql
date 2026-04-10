-- ============================================================
-- HARDENING MIGRATION: Corrección de 11 fallos críticos
-- ============================================================

-- ====================================================
-- FALLO #1: messages.created_at es BIGINT pero el código
-- compara con ISO strings (.toISOString()). Esto hace que
-- el filtro de mensajes efímeros (expires_at > now) falle
-- silenciosamente en todos los clientes.
-- CAUSA RAÍZ: Tipo de dato inconsistente en la columna.
-- FIX: Añadir columnas faltantes con el tipo correcto.
-- ====================================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at_iso TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attached_file JSONB;

-- ====================================================
-- FALLO #2: content_reads tiene un UNIQUE CONSTRAINT
-- implícito en el upsert pero la tabla fue creada SIN él.
-- Esto causa que upsert falle o inserte duplicados.
-- CAUSA RAÍZ: onConflict especifica campos no indexados.
-- FIX: Añadir el unique constraint necesario.
-- ====================================================
ALTER TABLE public.content_reads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.content_reads ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'content_reads_user_content_unique'
  ) THEN
    ALTER TABLE public.content_reads 
    ADD CONSTRAINT content_reads_user_content_unique 
    UNIQUE (user_id, content_id, content_type);
  END IF;
END $$;

-- ====================================================
-- FALLO #3: useTyping crea un canal con clave userId
-- pero setTyping crea OTRO canal sin esa clave.
-- Son dos canales diferentes → presence no funciona.
-- Esto no se puede fijar en SQL, se fija en el código.
-- (Ver useChat.js fix abajo)
-- ====================================================

-- ====================================================
-- FALLO #4: updateAnyUserProfile en useAppAuth no verifica
-- que el caller sea admin. Cualquier usuario autenticado
-- podría llamar a esta función y escalar privilegios.
-- CAUSA RAÍZ: No hay RLS para UPDATE en profiles para roles.
-- FIX: Policy que solo deja cambiar roles a admin/developer.
-- ====================================================
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile." ON public.profiles;

-- Un usuario solo puede actualizar su propio perfil
CREATE POLICY "Users can update own profile." ON public.profiles 
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (
  -- Bloquear cambios de rol a uno mismo (seguridad anti-escalada)
  role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  OR
  -- Solo admins pueden cambiar roles
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'developer'))
);

-- Admins pueden actualizar cualquier perfil
CREATE POLICY "Admins can update any profile." ON public.profiles
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'developer'))
);

-- ====================================================
-- FALLO #5: INSERT en profiles no está permitido.
-- El trigger handle_new_user hace el INSERT pero si falla
-- el trigger, el usuario no puede crear su perfil.
-- CAUSA RAÍZ: Falta la política INSERT en profiles.
-- FIX: Permitir INSERT solo para el mismo usuario.
-- ====================================================
DROP POLICY IF EXISTS "Users can insert own profile." ON public.profiles;
CREATE POLICY "Users can insert own profile." ON public.profiles 
FOR INSERT WITH CHECK (auth.uid() = id);

-- ====================================================
-- FALLO #6: El Realtime de useSupabaseData usa un canal
-- genérico 'db-changes' que escucha TODAS las tablas.
-- Si el canal se reconecta, puede recibir eventos duplicados
-- o perderse eventos del pasado (no hay recovery).
-- CAUSA RAÍZ: Falta de idempotencia en el handler INSERT.
-- FIX: Añadir unique index donde sea necesario para prevenir
-- duplicados en la BD (el frontend ya maneja replaceOptimistic).
-- ====================================================
-- Índices para prevenir duplicados críticos
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique 
  ON public.submissions (activity_id, student_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique 
  ON public.attendance (event_id, student_id);

-- ====================================================
-- FALLO #7: La tabla 'typing' usada por useGlobalTyping
-- no existe en el schema. La función hace polling ciego
-- a una tabla inexistente. Silenciado por el catch,
-- pero consume recursos y produce errores en logs.
-- FIX: Crear la tabla para que el sistema funcione.
-- ====================================================
CREATE TABLE IF NOT EXISTS public.typing (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  chat_id TEXT NOT NULL,
  last_typed BIGINT,
  PRIMARY KEY (user_id, chat_id)
);

ALTER TABLE public.typing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Typing visible to all." ON public.typing;
CREATE POLICY "Typing visible to all." ON public.typing FOR ALL TO authenticated USING (true);

-- ====================================================
-- FALLO #8: La tabla 'groups' usada en useGroups
-- tampoco existe en el schema inicial.
-- CAUSA RAÍZ: Tabla omitida en la migración original.
-- FIX: Crear la tabla con todas sus columnas.
-- ====================================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  members JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  permissions JSONB DEFAULT '{}'::jsonb,
  image_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Group members can view." ON public.groups;
DROP POLICY IF EXISTS "Group creators can manage." ON public.groups;
CREATE POLICY "Group members can view." ON public.groups 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Group creators can manage." ON public.groups 
  FOR ALL TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
  );

-- ====================================================
-- FALLO #9: Tabla 'feedback' y 'changelog' no tienen RLS.
-- Cualquier usuario no autenticado puede leer datos.
-- ====================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id),
  author_name TEXT,
  message TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.changelog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT,
  title TEXT,
  description TEXT,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Feedback visible to auth." ON public.feedback;
DROP POLICY IF EXISTS "Changelog visible to auth." ON public.changelog;
DROP POLICY IF EXISTS "Students can submit feedback." ON public.feedback;
DROP POLICY IF EXISTS "Admins manage changelog." ON public.changelog;

CREATE POLICY "Feedback visible to auth." ON public.feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students can submit feedback." ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Changelog visible to auth." ON public.changelog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage changelog." ON public.changelog FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- ====================================================
-- FALLO #10: Tabla 'grading_configs' no tiene políticas.
-- ====================================================
CREATE TABLE IF NOT EXISTS public.grading_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  config JSONB,
  author_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.grading_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Grading configs viewable by auth." ON public.grading_configs;
DROP POLICY IF EXISTS "Teachers manage grading configs." ON public.grading_configs;
CREATE POLICY "Grading configs viewable by auth." ON public.grading_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers manage grading configs." ON public.grading_configs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- ====================================================
-- FALLO #11: Realtime no está habilitado para las tablas
-- nuevas (groups, feedback, changelog, grading_configs, typing).
-- Esto significa los cambios no se propagan en tiempo real.
-- ====================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.groups; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.changelog; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.grading_configs; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_codes; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_notes; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reads; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ====================================================
-- BONUS: Función delete_user_account (Requerida por handleDeleteAccount)
-- Sin esta función, el botón "Eliminar cuenta" falla silenciosamente.
-- ====================================================
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;
  
  -- Borrar datos del usuario en cascada (el CASCADE en FK maneja el resto)
  DELETE FROM public.profiles WHERE id = auth.uid();
  
  -- Borrar el usuario de auth (requiere service_role o función SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Conceder permisos de ejecución solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
