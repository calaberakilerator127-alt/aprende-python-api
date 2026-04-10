-- TABLA PARA REGISTROS DE AUDITORÍA (AUDIT LOGS)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id),
  admin_name TEXT,
  admin_role TEXT,
  action TEXT,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar entradas en la tabla de settings
INSERT INTO public.settings (key, value) VALUES 
('security_whitelist', '{"emails": []}'::jsonb),
('security_blacklist', '{"emails": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Habilitar Realtime para auditoría
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
