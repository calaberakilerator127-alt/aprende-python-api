-- ============================================================
-- TOTAL SYSTEM HARDENING & MODULE STABILIZATION (v2)
-- ============================================================

-- 1. FIX SCHEMA INCONSISTENCIES
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at_iso TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS author_name TEXT;

-- 2. RESET & RE-APPLY RLS POLICIES FOR ALL CRITICAL TABLES
-- This ensures no table is left with 'RLS Enabled but 0 Policies'

-- ACTIVITIES
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Activities are viewable by everyone authenticated." ON public.activities;
DROP POLICY IF EXISTS "Teachers can manage activities." ON public.activities;
CREATE POLICY "Activities are viewable by everyone authenticated." ON public.activities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can manage activities." ON public.activities FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- SUBMISSIONS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own submissions." ON public.submissions;
DROP POLICY IF EXISTS "Teachers can view all submissions." ON public.submissions;
DROP POLICY IF EXISTS "Students can create submissions." ON public.submissions;
DROP POLICY IF EXISTS "Students can update own submissions." ON public.submissions;

CREATE POLICY "Students can view own submissions." ON public.submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view all submissions." ON public.submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);
CREATE POLICY "Students can create submissions." ON public.submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own submissions." ON public.submissions FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "Teachers can grade submissions." ON public.submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- CONTENT READS
ALTER TABLE public.content_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow user to manage own reads" ON public.content_reads;
CREATE POLICY "Allow user to manage own reads" ON public.content_reads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Teachers can view read stats" ON public.content_reads FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- CALL LOGS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users can insert call logs" ON public.call_logs;
CREATE POLICY "Users can view own call logs" ON public.call_logs FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert call logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() = caller_id);

-- SAVED CODES & NOTES
ALTER TABLE public.saved_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Manage own codes" ON public.saved_codes;
DROP POLICY IF EXISTS "Manage own notes" ON public.saved_notes;
CREATE POLICY "Manage own codes" ON public.saved_codes FOR ALL USING (auth.uid() = author_id);
CREATE POLICY "Manage own notes" ON public.saved_notes FOR ALL USING (auth.uid() = author_id);

-- FEEDBACK & CHANGELOG
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Feedback policies" ON public.feedback;
CREATE POLICY "Feedback select" ON public.feedback FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Feedback insert" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Changelog select" ON public.changelog;
CREATE POLICY "Changelog select" ON public.changelog FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Changelog manage" ON public.changelog FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- GRADING CONFIGS
ALTER TABLE public.grading_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Grading manage" ON public.grading_configs;
CREATE POLICY "Grading view" ON public.grading_configs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Grading manage" ON public.grading_configs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- SETTINGS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Settings view" ON public.settings;
DROP POLICY IF EXISTS "Settings manage" ON public.settings;
CREATE POLICY "Settings view" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Settings manage" ON public.settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('profesor', 'admin', 'developer'))
);

-- MESSAGES (Refining)
DROP POLICY IF EXISTS "Messages select" ON public.messages;
DROP POLICY IF EXISTS "Messages insert" ON public.messages;
CREATE POLICY "Messages select" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR chat_id LIKE 'public%');
CREATE POLICY "Messages insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Messages update" ON public.messages FOR UPDATE USING (auth.uid() = sender_id);

-- 3. UNIFY STORAGE POLICIES (One more time to be 100% sure)
-- This covers ALL buckets at once
DROP POLICY IF EXISTS "Global storage select" ON storage.objects;
DROP POLICY IF EXISTS "Global storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Global storage update" ON storage.objects;
DROP POLICY IF EXISTS "Global storage delete" ON storage.objects;

CREATE POLICY "Global storage select" ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Global storage insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Global storage update" ON storage.objects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Global storage delete" ON storage.objects FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4. ENSURE REALTIME
DO $$
BEGIN
  -- Add all tables to realtime publication if not already there
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activities; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.materials; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.news; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.forum; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.events; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN others THEN NULL; END;
END $$;
