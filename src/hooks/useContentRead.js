import { useEffect } from 'react';
import { supabase } from '../config/supabase';

export function useContentRead(userId, contentId, contentType) {
  useEffect(() => {
    if (!userId || !contentId || !contentType) return;

    const trackRead = async () => {
      try {
        // Only track if user is a student (teachers don't need to track their own reads)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (profile?.role !== 'estudiante') return;

        // Upsert to ensure we only have one record per user/content
        await supabase
          .from('content_reads')
          .upsert({
            user_id: userId,
            content_id: contentId,
            content_type: contentType,
            read_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id, content_id, content_type' 
          });
      } catch (e) {
        // Silenciamos el error si la tabla no existe aún (404) para mantener la consola limpia
        if (!e.message?.includes('404')) {
          console.error('Error tracking read status:', e);
        }
      }
    };

    trackRead();
  }, [userId, contentId, contentType]);
}
