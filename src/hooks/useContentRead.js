import { useEffect } from 'react';
import api from '../config/api';

export function useContentRead(userId, contentId, contentType) {
  useEffect(() => {
    if (!userId || !contentId || !contentType) return;

    const trackRead = async () => {
      try {
        // En lugar de verificar el rol aquí (que requiere una consulta extra),
        // dejamos que el backend lo maneje o simplemente registramos la lectura.
        // Si es necesario verificar, podemos usar api.get('/auth/me') o similar,
        // pero useAppData ya tiene los perfiles si se necesita.
        
        await api.post('/data/content_reads', {
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          read_at: new Date().toISOString()
        });
      } catch (e) {
        // Ignoramos errores de duplicados o red para lectura silenciosa
      }
    };

    trackRead();
  }, [userId, contentId, contentType]);
}
