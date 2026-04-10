import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://aprende-python-api.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para añadir el token JWT a todas las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pm_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor para manejar errores globales (ej: token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Sesión expirada o no autorizada. Limpiando datos...');
      localStorage.removeItem('pm_auth_token');
      localStorage.removeItem('pm_auth_user');
      localStorage.removeItem('pm_auth_profile');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
