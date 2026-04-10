const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const auth = require('./auth');
require('dotenv').config({ path: '../.env.server' });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://aprende-python-theta.vercel.app', 'https://aprende-python-4s3yqy59o-isgosk127-2503s-projects.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE MIDDLEWARES ---
app.use(cors({
  origin: ['https://aprende-python-theta.vercel.app', 'https://aprende-python-psg1yht1h-isgosk127-2503s-projects.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Carpeta para subida de archivos
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Configuración de Multer para File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware para verificar si el usuario es Admin
const verifyAdmin = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.id]);
    if (rows.length > 0 && (rows[0].role === 'admin' || rows[0].role === 'profesor' || rows[0].role === 'developer')) {
      next();
    } else {
      res.status(403).json({ error: 'Acceso restringido a administradores' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error verificando permisos' });
  }
};

// --- RUTAS DE AUTENTICACIÓN (Ya existentes) ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const passwordHash = await auth.hashPassword(password);
    await db.query('BEGIN');
    const userRes = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );
    const userId = userRes.rows[0].id;
    await db.query(
      'INSERT INTO profiles (id, email) VALUES ($1, $2)',
      [userId, email]
    );
    await db.query('COMMIT');
    const token = auth.generateToken(userId);
    res.status(201).json({ token, user: { id: userId, email } });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = rows[0];
    const valid = await auth.comparePassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = auth.generateToken(user.id);
    res.json({ token, user: { id: user.id, email } });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;
  const payload = await auth.verifyGoogleToken(idToken);
  if (!payload) return res.status(401).json({ error: 'Google Token inválido' });
  const { sub: googleId, email, name, picture } = payload;
  try {
    let { rows } = await db.query('SELECT id FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
    let userId;
    if (rows.length === 0) {
      await db.query('BEGIN');
      const userRes = await db.query(
        'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
        [email, googleId]
      );
      userId = userRes.rows[0].id;
      await db.query(
        'INSERT INTO profiles (id, email, name, photo_url, is_setup) VALUES ($1, $2, $3, $4, $5)',
        [userId, email, name, picture, true]
      );
      await db.query('COMMIT');
    } else {
      userId = rows[0].id;
      await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);
    }
    const token = auth.generateToken(userId);
    res.json({ token, user: { id: userId, email } });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Error procesando login de Google' });
  }
});

app.get('/api/auth/me', auth.verifyToken, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// --- SISTEMA CRUD GENÉRICO (Reemplazo de Supabase Client) ---

// Tablas permitidas para operaciones directas (Whitelist)
const ALLOWED_TABLES = [
  'activities', 'submissions', 'materials', 'events', 'notifications',
  'call_logs', 'attendance', 'news', 'forum', 'comments',
  'saved_codes', 'saved_notes', 'feedback', 'changelog', 'grading_configs',
  'messages', 'groups', 'settings', 'profiles', 'content_reads', 'presence'
];

// Ayudante para emitir cambios vía Sockets
const broadcastChange = (table, eventType, data, oldData = null) => {
  io.emit('db_change', { table, eventType, new: data, old: oldData });
};

// GET - Listar registros de una tabla
app.get('/api/data/:table', auth.verifyToken, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Tabla no permitida' });

  try {
    // Verificar si la tabla tiene created_at antes de ordenar
    const hasCreatedAt = !['settings', 'typing'].includes(table);
    const query = hasCreatedAt 
      ? `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 500`
      : `SELECT * FROM ${table} LIMIT 500`;
      
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error(`Error en GET /api/data/${table}:`, err);
    res.status(500).json({ error: `Error obteniendo datos de ${table}` });
  }
});

// POST - Crear registro
app.post('/api/data/:table', auth.verifyToken, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Tabla no permitida' });

  const keys = Object.keys(req.body);
  const values = Object.values(req.body);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const { rows } = await db.query(query, values);
    const newRecord = rows[0];
    
    broadcastChange(table, 'INSERT', newRecord);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Error creando registro en ${table}` });
  }
});

// PUT - Actualizar registro
app.put('/api/data/:table/:id', auth.verifyToken, async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Tabla no permitida' });

  const keys = Object.keys(req.body);
  const values = Object.values(req.body);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

  try {
    const query = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
    const { rows } = await db.query(query, [...values, id]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });
    
    const updatedRecord = rows[0];
    broadcastChange(table, 'UPDATE', updatedRecord);
    res.json(updatedRecord);
  } catch (err) {
    res.status(500).json({ error: `Error actualizando registro en ${table}` });
  }
});

// DELETE - Eliminar registro
app.delete('/api/data/:table/:id', auth.verifyToken, async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Tabla no permitida' });

  try {
    const { rows: oldRows } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (oldRows.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });

    await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    broadcastChange(table, 'DELETE', null, { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Error eliminando registro en ${table}` });
  }
});

// --- RUTAS ESPECIALES ---

// Subida de Archivos
app.post('/api/upload', auth.verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Configuración de Perfil (setup)
app.put('/api/profiles/setup', auth.verifyToken, async (req, res) => {
  const { name, role, ...extra } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE profiles SET name = $1, role = $2, is_setup = true WHERE id = $3 RETURNING *',
      [name, role, req.user.id]
    );
    const updatedProfile = rows[0];
    broadcastChange('profiles', 'UPDATE', updatedProfile);
    res.json(updatedProfile);
  } catch (err) {
    res.status(500).json({ error: 'Error al configurar perfil' });
  }
});

// --- LÓGICA DE TIEMPO REAL (SOCKET.IO) ---

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Unirse a una sala específica de chat (opcional para segmentar tráfico)
  socket.on('join_chat', (chatId) => {
    socket.join(`chat:${chatId}`);
  });

  // Notificar que un usuario está escribiendo
  socket.on('typing_start', ({ chatId, userId, userName }) => {
    socket.to(`chat:${chatId}`).emit('user_typing', { userId, userName, isTyping: true });
    // Opcional: Persistir en DB si es necesario, pero suele ser volátil
  });

  socket.on('typing_stop', ({ chatId, userId }) => {
    socket.to(`chat:${chatId}`).emit('user_typing', { userId, isTyping: false });
  });

  // Manejo de Presencia (Online/Offline)
  socket.on('user_online', async ({ userId }) => {
    socket.userId = userId;
    try {
      await db.query(
        'INSERT INTO presence (user_id, status, last_seen) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET status = $2, last_seen = NOW()',
        [userId, 'online']
      );
      io.emit('presence_change', { userId, status: 'online' });
    } catch (err) {
      console.error('Error actualizando presencia:', err);
    }
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      try {
        await db.query('UPDATE presence SET status = $1, last_seen = NOW() WHERE user_id = $2', ['offline', socket.userId]);
        io.emit('presence_change', { userId: socket.userId, status: 'offline' });
      } catch (err) {
        console.error('Error al desconectar presencia:', err);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor API & Realtime corriendo en http://localhost:${PORT}`);
});
