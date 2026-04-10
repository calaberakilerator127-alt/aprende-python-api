-- 1. HABILITAR BORRADO EN CASCADA PARA TODAS LAS RELACIONES
-- Perfiles -> Auth.Users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Actividades -> Perfiles
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_author_id_fkey;
ALTER TABLE public.activities ADD CONSTRAINT activities_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Eventos -> Perfiles
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_author_id_fkey;
ALTER TABLE public.events ADD CONSTRAINT events_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Mensajes -> Perfiles (Sender y Recipient)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Materiales, Noticias, Foro -> Perfiles
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_author_id_fkey;
ALTER TABLE public.materials ADD CONSTRAINT materials_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.news DROP CONSTRAINT IF EXISTS news_author_id_fkey;
ALTER TABLE public.news ADD CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.forum DROP CONSTRAINT IF EXISTS forum_author_id_fkey;
ALTER TABLE public.forum ADD CONSTRAINT forum_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Comentarios -> Perfiles
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE public.comments ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Call Logs -> Perfiles
ALTER TABLE public.call_logs DROP CONSTRAINT IF EXISTS call_logs_caller_id_fkey;
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs DROP CONSTRAINT IF EXISTS call_logs_receiver_id_fkey;
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Códigos y Notas -> Perfiles
ALTER TABLE public.saved_codes DROP CONSTRAINT IF EXISTS saved_codes_author_id_fkey;
ALTER TABLE public.saved_codes ADD CONSTRAINT saved_codes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.saved_notes DROP CONSTRAINT IF EXISTS saved_notes_author_id_fkey;
ALTER TABLE public.saved_notes ADD CONSTRAINT saved_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Feedback -> Perfiles
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_author_id_fkey;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. FUNCIÓN SEGURA PARA AUTO-BORRADO DE CUENTA
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
BEGIN
    -- Al borrar de auth.users, el ON DELETE CASCADE borrará public.profiles 
    -- y de ahí saltará a todas las demás tablas conectadas.
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
