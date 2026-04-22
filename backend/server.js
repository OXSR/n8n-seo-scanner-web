require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');

// Utility to hash API keys
const hashApiKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-seo-scanner';

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite por IP
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.'
});
app.use('/api/', apiLimiter);

// DB Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

// Init DB Schema
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Forzamos la eliminación de las tablas antiguas para aplicar el nuevo esquema con key_hash
      DROP TABLE IF EXISTS scans_history CASCADE;
      DROP TABLE IF EXISTS api_keys CASCADE;
      
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        key_hash VARCHAR(255) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT false,
        node_id VARCHAR(255),
        total_uses INTEGER DEFAULT 0,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS scans_history (
        id SERIAL PRIMARY KEY,
        api_key_id INTEGER REFERENCES api_keys(id),
        target_url VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        score INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Base de datos y tablas inicializadas correctamente.');
  } catch (error) {
    console.error('Error inicializando DB:', error);
  }
};
initDb();

// Middleware de Autenticación JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.user = user;
    next();
  });
};

// --- RUTAS DE AUTENTICACIÓN ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) return res.status(400).json({ error: 'El email ya está registrado' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    res.status(201).json({ message: 'Usuario registrado exitosamente', user: newUser.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Inicio de sesión exitoso', token, user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- RUTAS DE API KEYS ---

app.get('/api/keys/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, active, total_uses, last_used, created_at, node_id FROM api_keys WHERE user_id = $1', [req.user.id]);
    res.json({ key: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la clave API' });
  }
});

app.post('/api/keys/generate', authenticateToken, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM api_keys WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Ya tienes una clave generada.' });

    const rawKey = 'sk_' + crypto.randomBytes(24).toString('hex');
    const keyHash = hashApiKey(rawKey);
    
    const result = await pool.query(
      'INSERT INTO api_keys (user_id, key_hash) VALUES ($1, $2) RETURNING id, active, created_at',
      [req.user.id, keyHash]
    );
    res.status(201).json({ 
      message: 'Clave generada exitosamente. Guárdala en un lugar seguro, no se volverá a mostrar.', 
      keyData: result.rows[0],
      apiKey: rawKey // Only shown once
    });
  } catch (error) {
    console.error('Error generating key:', error);
    res.status(500).json({ error: 'Error al generar la clave: ' + error.message });
  }
});

// Endpoint público para activar una API Key desde el frontend
app.post('/api/keys/activate', async (req, res) => {
  const { apiKey, nodeId } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'La API Key es requerida' });

  try {
    const keyHash = hashApiKey(apiKey);
    const result = await pool.query('SELECT id, active FROM api_keys WHERE key_hash = $1', [keyHash]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'API Key no válida o no encontrada' });
    if (result.rows[0].active) return res.status(400).json({ error: 'Esta API Key ya está activa' });

    await pool.query(
      'UPDATE api_keys SET active = true, node_id = $1 WHERE id = $2',
      [nodeId || 'unknown', result.rows[0].id]
    );

    res.json({ message: 'API Key validada y activada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al activar la API Key' });
  }
});

app.post('/api/keys/toggle', authenticateToken, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, active FROM api_keys WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'No se encontró ninguna clave' });

    const newStatus = !existing.rows[0].active;
    const result = await pool.query(
      'UPDATE api_keys SET active = $1 WHERE user_id = $2 RETURNING *',
      [newStatus, req.user.id]
    );
    res.json({ message: `Clave ${newStatus ? 'activada' : 'desactivada'} exitosamente`, key: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el estado de la clave' });
  }
});

// --- RUTAS DE HISTORIAL Y USO (Dashboard) ---
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const keyResult = await pool.query('SELECT id FROM api_keys WHERE user_id = $1', [req.user.id]);
    if (keyResult.rows.length === 0) return res.json({ history: [] });
    
    const historyResult = await pool.query(
      'SELECT * FROM scans_history WHERE api_key_id = $1 ORDER BY created_at DESC LIMIT 50',
      [keyResult.rows[0].id]
    );
    res.json({ history: historyResult.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// --- RUTAS DE INTEGRACIÓN (Para el Nodo n8n) ---

// Validar clave (El nodo llama a este endpoint antes de escanear)
app.post('/api/node/validate-key', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ valid: false, error: 'API Key es requerida' });

  try {
    const keyHash = hashApiKey(apiKey);
    const result = await pool.query('SELECT id, active FROM api_keys WHERE key_hash = $1', [keyHash]);
    if (result.rows.length === 0) return res.status(404).json({ valid: false, error: 'API Key no encontrada' });
    if (!result.rows[0].active) return res.status(403).json({ valid: false, error: 'API Key está inactiva. Actívala primero.' });

    // Actualizar uso
    await pool.query('UPDATE api_keys SET total_uses = total_uses + 1, last_used = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].id]);
    
    res.json({ valid: true, message: 'Clave válida', apiKeyId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ valid: false, error: 'Error validando la clave' });
  }
});

// Registrar un escaneo finalizado (El nodo llama a este endpoint tras escanear)
app.post('/api/node/log-scan', async (req, res) => {
  const { apiKeyId, targetUrl, status, score } = req.body;
  if (!apiKeyId || !targetUrl) return res.status(400).json({ error: 'Datos incompletos' });

  try {
    await pool.query(
      'INSERT INTO scans_history (api_key_id, target_url, status, score) VALUES ($1, $2, $3, $4)',
      [apiKeyId, targetUrl, status || 'Completado', score || 0]
    );
    res.status(201).json({ message: 'Escaneo registrado en el historial' });
  } catch (error) {
    res.status(500).json({ error: 'Error registrando el escaneo' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
