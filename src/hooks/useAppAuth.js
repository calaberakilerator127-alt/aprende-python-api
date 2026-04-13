import { useState, useEffect, useRef } from 'react';
import api from '../config/api';

export function useAppAuth() {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('pm_auth_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [profile, setProfile] = useState(() => {
    const cached = localStorage.getItem('pm_auth_profile');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [spectatingProfile, setSpectatingProfile] = useState(null);

  useEffect(() => {
    if (user?.email) {
      const privilegedEmails = ['admin@tdsc.isgosk.com', 'developer@tdsc.isgosk.com'];
      setIsPrivileged(privilegedEmails.includes(user.email));
    } else {
      setIsPrivileged(false);
    }
  }, [user]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('pm_auth_token');
      if (token && !profile) {
        await fetchProfile();
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/me');
      if (data) {
        if (data.is_banned) {
          setIsBlacklisted(true);
          return;
        }
        setProfile(data);
        localStorage.setItem('pm_auth_profile', JSON.stringify(data));
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (googleResponse) => {
    try {
      setLoading(true);
      // googleResponse.credential es el idToken que envía el botón de Google Sign-In
      const { data } = await api.post('/auth/google', { idToken: googleResponse.credential });
      
      localStorage.setItem('pm_auth_token', data.token);
      localStorage.setItem('pm_auth_user', JSON.stringify(data.user));
      setUser(data.user);
      await fetchProfile();
    } catch (error) {
      console.error("Error en Google Login:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (email, password) => {
    try {
      setLoading(true);
      const { data } = await api.post('/auth/login', { email, password });
      
      localStorage.setItem('pm_auth_token', data.token);
      localStorage.setItem('pm_auth_user', JSON.stringify(data.user));
      setUser(data.user);
      await fetchProfile();
      return data;
    } catch (error) {
      console.error("Error en login por correo:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (email, password) => {
    try {
      setLoading(true);
      const { data } = await api.post('/auth/register', { email, password });
      
      localStorage.setItem('pm_auth_token', data.token);
      localStorage.setItem('pm_auth_user', JSON.stringify(data.user));
      setUser(data.user);
      await fetchProfile();
      return data;
    } catch (error) {
      console.error("Error en registro por correo:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSetProfile = async (name, role, extraData = {}) => {
    try {
      setLoading(true);
      const { data } = await api.put('/profiles/setup', { name, role, ...extraData });
      setProfile(data);
      localStorage.setItem('pm_auth_profile', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Error al configurar perfil:", e);
      setLoading(false);
      return false;
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('pm_auth_token');
    localStorage.removeItem('pm_auth_user');
    localStorage.removeItem('pm_auth_profile');
    setUser(null);
    setProfile(null);
    window.location.reload();
  };

  return { 
    user, profile, loading, isPrivileged, isBlacklisted,
    spectatingProfile, setSpectatingProfile,
    handleGoogleLogin, handleEmailLogin, handleEmailRegister, 
    handleSetProfile, handleLogout,
    // Los demás métodos se implementarán conforme se creen los endpoints en la API
    updateProfileData: async (d) => { 
      try {
        // Map common fields to snake_case for the database
        const mappedData = { ...d };
        if (mappedData.photoURL) {
          mappedData.photo_url = mappedData.photoURL;
          delete mappedData.photoURL;
        }
        const { data } = await api.put(`/data/profiles/${profile.id}`, mappedData);
        setProfile(data);
        localStorage.setItem('pm_auth_profile', JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    handleDeleteAccount: async () => {
      try {
        await api.delete(`/data/profiles/${profile.id}`);
        handleLogout();
        return true;
      } catch (e) { return false; }
    },
    handlePasswordChange: async (newPassword) => {
      try {
        await api.put(`/data/profiles/${profile.id}`, { password: newPassword });
        return true;
      } catch (e) { return false; }
    },
    handleAdminResetPassword: async (userId, newPassword) => {
      try {
        await api.put(`/data/profiles/${userId}`, { password: newPassword });
        return true;
      } catch (e) { return false; }
    },
    updateAnyUserProfile: async (userId, data) => {
      try {
        await api.put(`/data/profiles/${userId}`, data);
        return true;
      } catch (e) { return false; }
    },
    handleKickUser: async (userId) => {
      try {
        await api.put(`/data/profiles/${userId}`, { session_valid: false });
        return true;
      } catch (e) { return false; }
    },
    handleBanUser: async (userId) => {
      try {
        await api.put(`/data/profiles/${userId}`, { is_banned: true });
        return true;
      } catch (e) { return false; }
    }
  };
}
