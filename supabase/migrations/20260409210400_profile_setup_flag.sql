-- MIGRACIÓN: FORZAR CONFIGURACIÓN DE PERFIL
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_setup BOOLEAN DEFAULT false;

-- Actualizar trigger para marcar como NO configurado por defecto
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, is_setup)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario'),
    CASE 
      WHEN new.email = 'developer@tdsc.isgosk.com' THEN 'profesor'
      WHEN new.email = 'admin@tdsc.isgosk.com' THEN 'profesor' 
      ELSE 'estudiante'
    END,
    FALSE -- Siempre empieza como NO configurado
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
