-- MIGRACIÓN: FEEDBACK Y CHANGELOG

-- 1. TABLA DE FEEDBACK
CREATE TABLE public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id SERIAL, -- PostgreSQL gestionará el incremento automáticamente
  title TEXT NOT NULL,
  content TEXT,
  category TEXT CHECK (category IN ('error', 'mejora', 'ideas', 'problemas')) DEFAULT 'error',
  status TEXT CHECK (status IN ('no solucionado', 'en proceso', 'solucionado')) DEFAULT 'no solucionado',
  author_id UUID REFERENCES public.profiles(id),
  author_name TEXT,
  author_photo TEXT,
  likes UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT
);

-- Hacer que los report_id empiecen en 1000 para mantener consistencia con Firebase
ALTER SEQUENCE feedback_report_id_seq RESTART WITH 1000;

-- 2. TABLA DE CHANGELOG
CREATE TABLE public.changelog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  release_date TEXT,
  changes JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT
);

-- 3. HABILITAR RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS
CREATE POLICY "Feedback viewable by authenticated users." ON public.feedback FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create feedback." ON public.feedback FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Developers/Admins can update feedback." ON public.feedback FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'developer'))
);

CREATE POLICY "Changelog viewable by everyone." ON public.changelog FOR SELECT USING (true);
CREATE POLICY "Only admins/devs can manage changelog." ON public.changelog FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'developer'))
);

-- 5. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.changelog;
