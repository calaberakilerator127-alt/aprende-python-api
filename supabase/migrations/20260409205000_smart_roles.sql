-- MIGRACIÓN: ROLES INTELIGENTES AL REGISTRO
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario'),
    CASE 
      WHEN new.email = 'developer@tdsc.isgosk.com' THEN 'profesor'
      WHEN new.email = 'admin@tdsc.isgosk.com' THEN 'profesor' 
      ELSE 'estudiante'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
