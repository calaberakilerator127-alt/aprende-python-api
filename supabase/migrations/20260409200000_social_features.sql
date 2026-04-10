-- 20260409200000_social_features.sql
-- MIGRACIÓN PARA FUNCIONALIDADES SOCIALES Y NOTIFICACIONES AUTOMÁTICAS

-- 1. ACTUALIZACIÓN DE TABLA NEWS (NOTICIAS)
ALTER TABLE public.news 
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dislikes UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. ACTUALIZACIÓN DE TABLA FORUM (FORO)
ALTER TABLE public.forum 
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'académico',
  ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dislikes UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. ACTUALIZACIÓN DE TABLA COMMENTS (COMENTARIOS)
ALTER TABLE public.comments 
  ADD COLUMN IF NOT EXISTS parent_type TEXT, -- 'news' o 'forum'
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS likes UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dislikes UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Cambiar created_at de BIGINT a TIMESTAMPTZ en comments si es necesario, 
-- pero por ahora mantendremos compatibilidad con el frontend que usa BIGINT si ya existe.
-- Sin embargo, el esquema inicial lo definió como BIGINT. Vamos a dejarlo así para no romper lógica de visualización.

-- 4. FUNCIONES Y TRIGGERS PARA NOTIFICACIONES AUTOMÁTICAS

-- Función para notificar nuevas NOTICIAS
CREATE OR REPLACE FUNCTION public.fn_notify_new_news()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (message, type, target_id, author_id, author_name, created_at)
  VALUES (
    '📢 Nuevo aviso: ' || new.title,
    'news',
    new.id,
    new.author_id,
    new.author_name,
    (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT -- Convertir a milisegundos para compatibilidad frontend
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_on_new_news
  AFTER INSERT ON public.news
  FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_new_news();

-- Función para notificar nuevos POSTS EN EL FORO
CREATE OR REPLACE FUNCTION public.fn_notify_new_forum_post()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (message, type, target_id, author_id, author_name, created_at)
  VALUES (
    '💬 Nueva publicación: ' || new.title,
    'forum',
    new.id,
    new.author_id,
    new.author_name,
    (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_on_new_forum_post
  AFTER INSERT ON public.forum
  FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_new_forum_post();

-- 5. POLÍTICAS DE RLS PARA COMENTARIOS (Permitir lectura a autenticados, escritura propia)
DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.comments;
CREATE POLICY "Comments viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'profesor'));
