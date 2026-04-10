import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://aprende-python-api.onrender.com';

const socket = io(SOCKET_URL, {
  autoConnect: false, // Conectaremos manualmente al tener el usuario
});

export default socket;
