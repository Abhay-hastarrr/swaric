const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Realm = require('./models/Realm');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Config
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/swaric_auth';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Middlewares
app.use(express.json());
app.use(cookieParser());

// CORS (allow Vite dev server)
app.use(
  cors({
    origin: [CORS_ORIGIN],
    credentials: true,
  })
);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [CORS_ORIGIN],
    credentials: true,
  },
});

// MongoDB connection
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    const token = req.cookies.token || bearerToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Routes
// Health
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const normalizedEmail = String(email).toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await User.create({ name: name || '', email: normalizedEmail, passwordHash });
    const token = generateToken({ userId: created._id.toString(), email: created.email });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.status(201).json({ id: created._id.toString(), name: created.name, email: created.email });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const normalizedEmail = String(email).toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = generateToken({ userId: user._id.toString(), email: user.email });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({ id: user._id.toString(), name: user.name, email: user.email });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  const { email } = req.user;
  const user = await User.findOne({ email }).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ id: user._id.toString(), name: user.name, email: user.email });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Realm routes
// List all realms (public to any authenticated user)
app.get('/api/realms', authRequired, async (req, res) => {
  const realms = await Realm.find({}).sort({ createdAt: -1 }).lean();
  res.json(realms.map((r) => ({ id: r._id.toString(), name: r.name, ownerId: r.ownerId.toString() })));
});

app.post('/api/realms', authRequired, async (req, res) => {
  const { name, mapData } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const created = await Realm.create({ name, mapData: mapData && Array.isArray(mapData) ? mapData : undefined, ownerId: req.user.userId });
  res.status(201).json({ id: created._id.toString(), name: created.name });
});

// Fetch any realm by id (public to any authenticated user)
app.get('/api/realms/:id', authRequired, async (req, res) => {
  const realm = await Realm.findById(req.params.id).lean();
  if (!realm) return res.status(404).json({ message: 'Realm not found' });
  res.json({ id: realm._id.toString(), name: realm.name, mapData: realm.mapData, ownerId: realm.ownerId.toString() });
});

app.get('/api/realms/:id/messages', authRequired, async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const realm = await Realm.findById(id).lean();
  if (!realm) return res.status(404).json({ message: 'Realm not found' });
  const messages = await Message.find({ realmId: id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json(
    messages
      .reverse()
      .map((m) => ({ id: m._id.toString(), senderId: m.senderId.toString(), content: m.content, createdAt: m.createdAt }))
  );
});

// In-memory presence state per realm
const realmPresence = new Map(); // realmId -> Map<userId, { x, y, name }>
const realmSockets = new Map(); // realmId -> Map<userId, socketId>

function getPresenceForRealm(realmId) {
  if (!realmPresence.has(realmId)) realmPresence.set(realmId, new Map());
  return realmPresence.get(realmId);
}

function getRealmSockets(realmId) {
  if (!realmSockets.has(realmId)) realmSockets.set(realmId, new Map());
  return realmSockets.get(realmId);
}

function parseCookie(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = decodeURIComponent(pair.slice(0, idx).trim());
      const val = decodeURIComponent(pair.slice(idx + 1).trim());
      result[key] = val;
    }
  });
  return result;
}

io.use((socket, next) => {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie || '');
    const token = cookies.token || (socket.handshake.auth && socket.handshake.auth.token);
    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = { id: decoded.userId, email: decoded.email };
    return next();
  } catch (err) {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  function broadcastPresence(realmId) {
    const presence = getPresenceForRealm(realmId);
    const snapshot = Array.from(presence.entries()).map(([userId, info]) => ({ userId, position: { x: info.x, y: info.y }, name: info.name }));
    io.to(`realm:${realmId}`).emit('presence', snapshot);
  }
  socket.on('joinRealm', async ({ realmId, position }) => {
    try {
      const realm = await Realm.findById(realmId).lean();
      if (!realm) return;
      socket.join(`realm:${realmId}`);
      const presence = getPresenceForRealm(realmId);
      const sockets = getRealmSockets(realmId);
      const startPos = position && typeof position.x === 'number' && typeof position.y === 'number' ? position : { x: 0, y: 0 };
      const me = await User.findById(socket.user.id).lean();
      const displayName = (me && me.name) || socket.user.email;
      presence.set(socket.user.id, { x: startPos.x, y: startPos.y, name: displayName });
      sockets.set(socket.user.id, socket.id);
      io.to(`realm:${realmId}`).emit('userJoined', { userId: socket.user.id, position: startPos, name: displayName });
      broadcastPresence(realmId);
      // Send current presence snapshot to new client
      socket.emit('presenceSnapshot', Array.from(presence.entries()).map(([userId, info]) => ({ userId, position: { x: info.x, y: info.y }, name: info.name })));
    } catch {}
  });

  socket.on('move', ({ realmId, x, y }) => {
    if (!realmId || typeof x !== 'number' || typeof y !== 'number') return;
    const presence = getPresenceForRealm(realmId);
    if (!presence.has(socket.user.id)) return;
    const current = presence.get(socket.user.id) || { name: socket.user.email };
    const newPos = { x, y, name: current.name };
    presence.set(socket.user.id, newPos);
    io.to(`realm:${realmId}`).emit('userMoved', { userId: socket.user.id, position: { x, y }, name: current.name });
    broadcastPresence(realmId);
  });

  socket.on('chat', async ({ realmId, content }) => {
    if (!realmId || !content) return;
    try {
      const message = await Message.create({ realmId, senderId: socket.user.id, content });
      io.to(`realm:${realmId}`).emit('chat', {
        id: message._id.toString(),
        realmId,
        senderId: socket.user.id,
        content,
        createdAt: message.createdAt,
      });
    } catch {}
  });

  socket.on('leaveRealm', ({ realmId }) => {
    if (!realmId) return;
    const presence = getPresenceForRealm(realmId);
    const sockets = getRealmSockets(realmId);
    if (presence.delete(socket.user.id)) {
      io.to(`realm:${realmId}`).emit('userLeft', { userId: socket.user.id });
      broadcastPresence(realmId);
    }
    sockets.delete(socket.user.id);
    socket.leave(`realm:${realmId}`);
  });

  socket.on('disconnect', () => {
    // Clean up: remove user from any presence maps
    for (const [realmId, presence] of realmPresence.entries()) {
      if (presence.delete(socket.user.id)) {
        io.to(`realm:${realmId}`).emit('userLeft', { userId: socket.user.id });
      }
      const sockets = getRealmSockets(realmId);
      sockets.delete(socket.user.id);
    }
  });

  // WebRTC signaling relay
  socket.on('webrtc:signal', ({ realmId, toUserId, data }) => {
    if (!realmId || !toUserId || !data) return;
    const sockets = getRealmSockets(realmId);
    const targetSocketId = sockets.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:signal', { fromUserId: socket.user.id, data });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});


