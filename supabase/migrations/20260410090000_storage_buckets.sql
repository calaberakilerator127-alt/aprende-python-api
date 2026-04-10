-- ============================================================
-- CREAR BUCKETS DE STORAGE (via SQL - Forma más confiable)
-- ============================================================

-- Bucket para materiales del curso (PDFs, PPTs, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials', 
  'materials', 
  true,
  52428800, -- 50MB límite
  ARRAY['application/pdf', 'application/vnd.ms-powerpoint', 
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket para archivos de chat
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat_uploads', 'chat_uploads', true, 20971520) -- 20MB
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles', 
  'profiles', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket para entregas de alumnos (attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', true, 52428800) -- 50MB
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================
-- POLÍTICAS DE STORAGE (Usando DROP + CREATE para seguridad)
-- ============================================================

-- MATERIALS: Lectura pública, subida solo para autenticados
DROP POLICY IF EXISTS "Public read materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete materials" ON storage.objects;

CREATE POLICY "Public read materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'materials');

CREATE POLICY "Authenticated upload materials" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'materials');

CREATE POLICY "Owner delete materials" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'materials' AND auth.uid() IS NOT NULL
  );

-- CHAT_UPLOADS: Solo usuarios autenticados
DROP POLICY IF EXISTS "Chat uploads policy" ON storage.objects;
CREATE POLICY "Chat uploads policy" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'chat_uploads')
  WITH CHECK (bucket_id = 'chat_uploads');

-- PROFILES: Cada usuario en su propia carpeta
DROP POLICY IF EXISTS "Profile photos policy" ON storage.objects;
CREATE POLICY "Profile photos policy" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'profiles')
  WITH CHECK (bucket_id = 'profiles');

-- ATTACHMENTS: Usuarios autenticados
DROP POLICY IF EXISTS "Attachments policy" ON storage.objects;
CREATE POLICY "Attachments policy" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');
