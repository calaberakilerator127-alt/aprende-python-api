-- MIGRACIÓN: ACTUALIZACIÓN PROFESIONAL DEL LMS (AULA AVANZADA)

-- 1. Extensiones para Configuraciones Académicas
ALTER TABLE public.grading_configs 
ADD COLUMN IF NOT EXISTS attendance_weight INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS include_attendance BOOLEAN DEFAULT false;

-- 2. Categorización y Prioridad de Eventos/Reuniones
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('normal', 'importante', 'recuperacion', 'tutoria')) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false;

-- 3. Trazabilidad de Lectura (Read Receipts)
CREATE TABLE IF NOT EXISTS public.content_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL, -- ID de actividad o material
  content_type TEXT NOT NULL CHECK (content_type IN ('actividad', 'material', 'entrega')),
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, content_id, content_type)
);

-- 4. Mejora de Comentarios (Hilos Multiuso)
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS parent_type TEXT CHECK (parent_type IN ('news', 'forum', 'submission')) DEFAULT 'forum';

-- 5. Seguridad RLS para trazabilidad de lectura
ALTER TABLE public.content_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden insertar sus propias lecturas" 
ON public.content_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios ven sus propias lecturas" 
ON public.content_reads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Profesores ven todas las lecturas" 
ON public.content_reads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- 6. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reads;
