-- MIGRACIÓN: REPARACIÓN TOTAL DE PERMISOS (RLS)

-- 1. NOTICIAS (NEWS)
DROP POLICY IF EXISTS "Todos pueden leer noticias" ON public.news;
CREATE POLICY "Todos pueden leer noticias" ON public.news FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo profesores publican noticias" ON public.news;
CREATE POLICY "Solo profesores publican noticias" ON public.news FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- 2. FORO (FORUM)
DROP POLICY IF EXISTS "Todos pueden leer el foro" ON public.forum;
CREATE POLICY "Todos pueden leer el foro" ON public.forum FOR SELECT USING (true);

DROP POLICY IF EXISTS "Todos pueden publicar en el foro" ON public.forum;
CREATE POLICY "Todos pueden publicar en el foro" ON public.forum FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Solo el autor puede editar su post" ON public.forum;
CREATE POLICY "Solo el autor puede editar su post" ON public.forum FOR UPDATE USING (auth.uid() = author_id);

-- 3. COMENTARIOS (COMMENTS)
DROP POLICY IF EXISTS "Todos pueden leer comentarios" ON public.comments;
CREATE POLICY "Todos pueden leer comentarios" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Todos pueden comentar" ON public.comments;
CREATE POLICY "Todos pueden comentar" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Solo el autor puede borrar su comentario" ON public.comments;
CREATE POLICY "Solo el autor puede borrar su comentario" ON public.comments FOR ALL USING (auth.uid() = author_id);

-- 4. MENSAJES (MESSAGES)
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propios mensajes" ON public.messages;
CREATE POLICY "Los usuarios pueden ver sus propios mensajes" ON public.messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

DROP POLICY IF EXISTS "Los usuarios pueden enviar mensajes" ON public.messages;
CREATE POLICY "Los usuarios pueden enviar mensajes" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 5. MATERIALES (MATERIALS)
DROP POLICY IF EXISTS "Todos pueden ver materiales" ON public.materials;
CREATE POLICY "Todos pueden ver materiales" ON public.materials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo profesores gestionan materiales" ON public.materials;
CREATE POLICY "Solo profesores gestionan materiales" ON public.materials FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- 6. EVENTOS (EVENTS)
DROP POLICY IF EXISTS "Todos pueden ver eventos" ON public.events;
CREATE POLICY "Todos pueden ver eventos" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo profesores gestionan eventos" ON public.events;
CREATE POLICY "Solo profesores gestionan eventos" ON public.events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- 7. NOTIFICACIONES (NOTIFICATIONS)
DROP POLICY IF EXISTS "Usuarios ven sus notificaciones" ON public.notifications;
CREATE POLICY "Usuarios ven sus notificaciones" ON public.notifications FOR SELECT USING (
  target_user_ids IS NULL OR 
  target_user_ids ? auth.uid()::text
);

DROP POLICY IF EXISTS "Todos pueden crear notificaciones de sistema" ON public.notifications;
CREATE POLICY "Todos pueden crear notificaciones de sistema" ON public.notifications FOR INSERT WITH CHECK (true);

-- 8. CÓDIGOS Y NOTAS GUARDADAS
DROP POLICY IF EXISTS "Acceso privado a códigos guardados" ON public.saved_codes;
CREATE POLICY "Acceso privado a códigos guardados" ON public.saved_codes FOR ALL USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Acceso privado a notas guardadas" ON public.saved_notes;
CREATE POLICY "Acceso privado a notas guardadas" ON public.saved_notes FOR ALL USING (auth.uid() = author_id);

-- 9. FEEDBACK Y CHANGELOG
DROP POLICY IF EXISTS "Todos pueden ver feedback" ON public.feedback;
CREATE POLICY "Todos pueden ver feedback" ON public.feedback FOR SELECT USING (true);

DROP POLICY IF EXISTS "Todos pueden enviar feedback" ON public.feedback;
CREATE POLICY "Todos pueden enviar feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Todos pueden ver el changelog" ON public.changelog;
CREATE POLICY "Todos pueden ver el changelog" ON public.changelog FOR SELECT USING (true);
