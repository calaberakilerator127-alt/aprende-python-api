import { useEffect } from 'react';
import socket from '../config/socket';
import api from '../config/api';

/**
 * Hook para gestionar la presencia en tiempo real del usuario usando Socket.io.
 */
export function usePresence(user, profile) {
  useEffect(() => {
    const userId = profile?.id || user?.id;
    if (!userId) return;

    // Función auxiliar para actualizar la DB vía API
    const updateDBStatus = async (status) => {
      try {
        await api.put(`/data/profiles/${userId}`, {
          status: status,
          last_seen: new Date().toISOString()
        });
      } catch (e) {
        console.error("Error actualizando presencia via API:", e);
      }
    };

    // Al conectar/desconectar el socket, también notificamos presencia
    const handleConnect = () => {
      socket.emit('user_online', { userId });
      updateDBStatus('Activo');
    };

    if (socket.connected) {
      handleConnect();
    }
    
    socket.on('connect', handleConnect);

    // Heartbeat: Actualizar last_seen cada 60 segundos
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateDBStatus('Activo');
      }
    }, 60000);

    // Manejo de visibilidad
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        socket.emit('user_online', { userId });
        updateDBStatus('Activo');
      } else {
        updateDBStatus('Inactivo');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeat);
      socket.off('connect', handleConnect);
      updateDBStatus('Inactivo');
    };
  }, [user?.id, profile?.id]);
}
