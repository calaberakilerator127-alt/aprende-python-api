-- MIGRACIÓN: SISTEMA ACADÉMICO AVANZADO

-- 1. Ampliar categorías en la tabla activities
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS rubric JSONB DEFAULT NULL;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS scale INTEGER DEFAULT 10;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check 
  CHECK (type IN ('tarea', 'actividades', 'evaluaciones', 'examenes', 'proyectos'));

-- 2. Mejorar la tabla de entregas para soportar rúbricas y feedback
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS rubric_scores JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;

-- 3. Tabla de configuraciones de calificación por profesor
CREATE TABLE IF NOT EXISTS public.grading_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  weights JSONB DEFAULT '{
    "tarea": 20,
    "actividades": 10,
    "evaluaciones": 30,
    "examenes": 30,
    "proyectos": 10
  }'::jsonb,
  grade_scale INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Asegurar que las entregas eliminadas (de usuarios eliminados) se limpien
-- Esto ya está cubierto por ON DELETE CASCADE en initial_schema, pero reforzamos índices
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities USING GIN (assigned_to);
CREATE INDEX IF NOT EXISTS idx_submissions_activity_id ON public.submissions (activity_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions (student_id);

-- 6. Habilitar seguridad a nivel de fila (RLS)
ALTER TABLE public.grading_configs ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de acceso para grading_configs
CREATE POLICY "Los profesores pueden gestionar sus propias configuraciones"
ON public.grading_configs
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Los estudiantes pueden leer las configuraciones de sus profesores"
ON public.grading_configs
FOR SELECT
TO authenticated
USING (true); -- Permitimos lectura global para simplificar el cálculo de promedios
