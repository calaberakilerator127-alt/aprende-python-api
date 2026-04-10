-- CORRECCIONES Y MEJORAS AL ESQUEMA DE CHAT
-- 1. Tabla de Grupos
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  members UUID[] DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id),
  permissions JSONB DEFAULT '{
    "canSendMessages": "all",
    "allowFiles": true,
    "allowEditInfo": true,
    "allowInvite": true
  }'::jsonb,
  last_message TEXT,
  last_message_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Columnas adicionales en Perfiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS blocked_users UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pinned_chats TEXT[] DEFAULT '{}';

-- 3. Mejoras en Mensajes
ALTER TABLE public.messages
RENAME COLUMN chat_id TO chatId; -- Mantener consistencia con el código JS si es necesario, o refactorizar a snake_case en JS. Preferible snake_case en DB.

-- Vamos a usar snake_case en DB y mapear en JS.
ALTER TABLE public.messages RENAME COLUMN chatId TO chat_id;
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attached_file JSONB,
ADD COLUMN IF NOT EXISTS expires_at BIGINT,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at BIGINT,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- 4. Mejoras en Call Logs
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS receiver_name TEXT,
ADD COLUMN IF NOT EXISTS caller_name TEXT,
ADD COLUMN IF NOT EXISTS chat_id TEXT,
ADD COLUMN IF NOT EXISTS meet_url TEXT,
ADD COLUMN IF NOT EXISTS participants UUID[],
ADD COLUMN IF NOT EXISTS event_id UUID;

-- 5. Habilitar Realtime para Grupos
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
