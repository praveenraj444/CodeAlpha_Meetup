import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in .env da!");
  process.exit(1);
}

// ================= GOOGLE OAUTH CLIENT =================
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
console.log(GOOGLE_CLIENT_ID ? '🔐 Google OAuth configured' : '⚠️ Google OAuth NOT configured');

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const cloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

console.log(cloudinaryConfigured ? '☁️ Cloudinary configured' : '⚠️ Cloudinary NOT configured (using base64 fallback)');

app.use(cors({
  origin: CLIENT_URL.split(',').map(s => s.trim()),
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// ================= MULTER (memory storage — for Cloudinary upload) =================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// ================= UPLOAD ENDPOINT (Cloudinary) =================
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (!cloudinaryConfigured) {
      return res.status(503).json({ 
        error: 'Cloudinary not configured',
        fallback: true 
      });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'meetup',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    console.log('☁️ Uploaded to Cloudinary:', result.secure_url);

    res.json({
      url: result.secure_url,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });
  } catch (err) {
    console.error('☁️ Cloudinary upload error:', err);
    res.status(500).json({ error: err.message, fallback: true });
  }
});

// ================= TURSO DATABASE SETUP =================
let db;

(async () => {
  try {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.error('❌ TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing in .env!');
      process.exit(1);
    }

    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });

    // ===== AUTO MIGRATION =====
    const tableCheck = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`
    );

    if (tableCheck.rows.length === 0) {
      // Fresh install — create full schema
      await db.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT,
          google_id TEXT,
          avatar TEXT,
          provider TEXT DEFAULT 'local',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Fresh users table created with Google OAuth support.');
    } else {
      // Check existing columns
      const tableInfo = await db.execute(`PRAGMA table_info(users)`);
      const hasGoogleId = tableInfo.rows.some(col => col.name === 'google_id');
      const hasAvatar = tableInfo.rows.some(col => col.name === 'avatar');
      const hasProvider = tableInfo.rows.some(col => col.name === 'provider');

      console.log('📊 Current users table schema:');
      console.log('   - google_id column:', hasGoogleId ? '✅' : '❌');
      console.log('   - avatar column:', hasAvatar ? '✅' : '❌');
      console.log('   - provider column:', hasProvider ? '✅' : '❌');

      // Add missing columns (SQLite ALTER TABLE ADD COLUMN is safe)
      if (!hasGoogleId) {
        await db.execute(`ALTER TABLE users ADD COLUMN google_id TEXT`);
        console.log('   ✅ Added google_id column');
      }
      if (!hasAvatar) {
        await db.execute(`ALTER TABLE users ADD COLUMN avatar TEXT`);
        console.log('   ✅ Added avatar column');
      }
      if (!hasProvider) {
        await db.execute(`ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local'`);
        console.log('   ✅ Added provider column');
      }

      console.log('✅ Users table migration complete.');
    }

    console.log('✅ Turso Connected: meetup-db');
  } catch (err) {
    console.error('❌ Turso DB setup error:', err);
    process.exit(1);
  }
})();

// ================= AUTH APIS =================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required da' });

    const exists = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    if (exists.rows.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: 'INSERT INTO users (name, email, password, provider) VALUES (?, ?, ?, ?)',
      args: [name, email, hashed, 'local']
    });

    const user = { id: Number(result.lastInsertRowid), name, email, avatar: null };
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    if (result.rows.length === 0) return res.status(400).json({ message: 'User not found' });

    const userRow = result.rows[0];
    if (!userRow.password) return res.status(400).json({ message: 'This account uses Google login. Please sign in with Google.' });

    const isMatch = await bcrypt.compare(password, userRow.password);
    if (!isMatch) return res.status(400).json({ message: 'Wrong password da' });

    const user = { id: Number(userRow.id), name: userRow.name, email: userRow.email, avatar: userRow.avatar || null };
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= GOOGLE OAUTH ENDPOINT =================
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential missing' });

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google OAuth not configured on server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) return res.status(400).json({ message: 'Email not found in Google account' });

    const existing = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });

    if (existing.rows.length > 0) {
      // AUTO-LINK
      const userRow = existing.rows[0];
      const newProvider = userRow.password ? 'both' : 'google';
      await db.execute({
        sql: 'UPDATE users SET google_id = ?, avatar = ?, provider = ? WHERE id = ?',
        args: [googleId, picture || null, newProvider, userRow.id]
      });
      console.log(`🔗 Auto-linked Google account: ${email} (provider: ${newProvider})`);

      const user = { 
        id: Number(userRow.id), 
        name: userRow.name, 
        email: userRow.email, 
        avatar: picture || userRow.avatar || null 
      };
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ user, token });
    } else {
      // NEW USER
      const result = await db.execute({
        sql: 'INSERT INTO users (name, email, password, google_id, avatar, provider) VALUES (?, ?, ?, ?, ?, ?)',
        args: [name || email.split('@')[0], email, null, googleId, picture || null, 'google']
      });
      console.log(`✨ New Google user created: ${email}`);

      const user = { 
        id: Number(result.lastInsertRowid), 
        name: name || email.split('@')[0], 
        email, 
        avatar: picture || null 
      };
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ user, token });
    }
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ message: 'Google login failed: ' + err.message });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 MEETUP Server Running - REAL JWT MODE (Turso)');
});

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: { origin: CLIENT_URL.split(',').map(s => s.trim()) },
  maxHttpBufferSize: 1e8
});

const rooms = {};

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log('❌ No token for socket:', socket.id);
    return next(new Error("No token - Login again da"));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    console.log('✅ Token verified:', decoded.name);
    next();
  } catch (e) {
    console.log('❌ Invalid token:', e.message);
    next(new Error("Invalid token"));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, socket.user.name);

  socket.on('join-room', ({ roomId, name }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        hostId: socket.id,
        chatBlocked: false,
        videoBlocked: false,
        screenShareBlocked: false,
        reactionsBlocked: false,
        locked: false,
        waiting: [],
        admitted: new Set()
      };
      rooms[roomId].admitted.add(socket.id);
    }
    const room = rooms[roomId];

    if (room.locked && socket.id !== room.hostId) {
      socket.emit('room-locked');
      return;
    }

    const isHostUser = socket.id === room.hostId;

    if (isHostUser) {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = socket.user.name;
      socket.data.waiting = false;

      const otherUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
        .filter(id => id !== socket.id && !io.sockets.sockets.get(id)?.data?.waiting)
        .map(id => {
          const s = io.sockets.sockets.get(id);
          return { id, name: s?.data?.name || s?.user?.name || 'Guest' };
        });

      socket.emit('room-joined', {
        users: otherUsers,
        hostId: room.hostId,
        youAreHost: true,
        chatBlocked: room.chatBlocked,
        videoBlocked: room.videoBlocked,
        screenShareBlocked: room.screenShareBlocked,
        reactionsBlocked: room.reactionsBlocked,
        waitingList: room.waiting
      });

      socket.to(roomId).emit('user-joined', { id: socket.id, name: socket.data.name });
      console.log(`👑 HOST ${socket.data.name} joined ${roomId}`);
    } else {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = socket.user.name;
      socket.data.waiting = true;

      const guest = { id: socket.id, name: socket.user.name };
      room.waiting.push(guest);

      io.to(room.hostId).emit('join-request', guest);
      socket.emit('waiting-room', { roomId });

      console.log(`⏳ ${socket.user.name} waiting to join ${roomId}`);
    }
  });

  // ===== HOST: ADMIT GUEST =====
  socket.on('host:admit', ({ guestId }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    const guestIndex = room.waiting.findIndex(g => g.id === guestId);
    if (guestIndex === -1) {
      console.log('⚠️ Guest not in waiting list:', guestId);
      return;
    }
    const guest = room.waiting[guestIndex];
    room.waiting.splice(guestIndex, 1);
    room.admitted.add(guestId);

    const guestSocket = io.sockets.sockets.get(guestId);
    if (!guestSocket) {
      console.log('⚠️ Guest socket not found:', guestId);
      return;
    }
    guestSocket.data.waiting = false;

    const otherUsers = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
      .filter(id => id !== guestId && !io.sockets.sockets.get(id)?.data?.waiting)
      .map(id => {
        const s = io.sockets.sockets.get(id);
        return { id, name: s?.data?.name || s?.user?.name || 'Guest' };
      });

    guestSocket.emit('room-joined', {
      users: otherUsers,
      hostId: room.hostId,
      youAreHost: false,
      chatBlocked: room.chatBlocked,
      videoBlocked: room.videoBlocked,
      screenShareBlocked: room.screenShareBlocked,
      reactionsBlocked: room.reactionsBlocked,
      waitingList: []
    });

    room.admitted.forEach((admittedId) => {
      if (admittedId !== guestId) {
        io.to(admittedId).emit('user-joined', { id: guestId, name: guest.name });
      }
    });

    io.to(room.hostId).emit('waiting-list-update', { waitingList: room.waiting });
    console.log(`✅ ${guest.name} ADMITTED to ${roomId}`);
  });

  // ===== HOST: DENY GUEST =====
  socket.on('host:deny', ({ guestId }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    const guestIndex = room.waiting.findIndex(g => g.id === guestId);
    if (guestIndex === -1) return;
    room.waiting.splice(guestIndex, 1);

    const guestSocket = io.sockets.sockets.get(guestId);
    if (guestSocket) {
      guestSocket.emit('join-denied');
      guestSocket.leave(roomId);
    }
    io.to(room.hostId).emit('waiting-list-update', { waitingList: room.waiting });
    console.log(`❌ Guest denied from ${roomId}`);
  });

  // ===== RAISE HAND =====
  socket.on('raise-hand', ({ raised }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit('hand-update', { userId: socket.id, raised: !!raised });
  });

  // ===== REACTIONS =====
  socket.on('send-reaction', ({ emoji }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (room?.reactionsBlocked && socket.id !== room.hostId) {
      console.log(`🚫 Reaction blocked from ${socket.user.name} in ${roomId}`);
      return;
    }
    io.to(roomId).emit('reaction', {
      userId: socket.id,
      name: socket.data.name,
      emoji,
      id: Date.now() + Math.random()
    });
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, name: socket.data.name, signal });
  });

  // ===== CHAT MESSAGE (TEXT) =====
  socket.on('chat-message', ({ text }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (room?.chatBlocked && socket.id !== room.hostId) return;

    io.to(roomId).emit('chat-message', {
      id: `m${Date.now()}${Math.random()}`,
      senderId: socket.id,
      name: socket.data.name,
      text,
      time: Date.now()
    });
  });

  // ===== FILE SHARE =====
  socket.on('file-share', ({ url, name, size, type }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (room?.chatBlocked && socket.id !== room.hostId) return;

    if (!url || !name) return;

    console.log(`📎 File shared by ${socket.data.name}: ${name} (${size} bytes)`);

    io.to(roomId).emit('file-share', {
      id: `f${Date.now()}${Math.random()}`,
      senderId: socket.id,
      name: socket.data.name,
      file: { url, name, size, type },
      time: Date.now()
    });
  });

  // Legacy send-message (backward compat)
  socket.on('send-message', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (room?.chatBlocked) return;
    io.to(roomId).emit('receive-message', {
      senderId: socket.id,
      senderName: socket.data.name,
      msg,
      time: new Date().toLocaleTimeString()
    });
  });

  // HOST CONTROLS
  socket.on('host:mute-all', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) socket.to(socket.data.roomId).emit('force-mute');
  });

  socket.on('host:unmute-all', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) io.to(socket.data.roomId).emit('host-unmute-all');
  });

  socket.on('host:video-off-all', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) {
      room.videoBlocked = true;
      io.to(socket.data.roomId).emit('video-blocked', { blocked: true });
      socket.to(socket.data.roomId).emit('force-video-off');
    }
  });

  socket.on('host:allow-video', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) {
      room.videoBlocked = false;
      io.to(socket.data.roomId).emit('video-blocked', { blocked: false });
    }
  });

  socket.on('host:block-chat', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) {
      room.chatBlocked = true;
      io.to(socket.data.roomId).emit('chat-blocked', { blocked: true });
    }
  });

  socket.on('host:allow-chat', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) {
      room.chatBlocked = false;
      io.to(socket.data.roomId).emit('chat-blocked', { blocked: false });
    }
  });

  // ===== HOST REACTIONS CONTROL =====
  socket.on('host:block-reactions', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    room.reactionsBlocked = true;
    io.to(roomId).emit('reactions-blocked', { blocked: true });
    console.log(`🚫 Reactions BLOCKED in ${roomId}`);
  });

  socket.on('host:allow-reactions', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    room.reactionsBlocked = false;
    io.to(roomId).emit('reactions-blocked', { blocked: false });
    console.log(`✅ Reactions ALLOWED in ${roomId}`);
  });

  socket.on('host:block-screenshare', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    room.screenShareBlocked = true;
    io.to(roomId).emit('screenshare-blocked', { blocked: true });
  });

  socket.on('host:allow-screenshare', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    room.screenShareBlocked = false;
    io.to(roomId).emit('screenshare-blocked', { blocked: false });
  });

  socket.on('host:stop-all-screenshare', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    io.to(roomId).emit('force-screenshare-off');
  });

  socket.on('host:lock-room', ({ locked }) => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) {
      room.locked = !!locked;
      io.to(socket.data.roomId).emit('room-locked-update', { locked: room.locked });
    }
  });

  socket.on('host:kick-user', ({ targetId }) => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) io.to(targetId).emit('kicked-out');
  });

  socket.on('host:end-room', () => {
    const room = rooms[socket.data.roomId];
    if (room && room.hostId === socket.id) {
      io.to(socket.data.roomId).emit('room-ended');
      delete rooms[socket.data.roomId];
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (room) {
      if (socket.data.waiting) {
        room.waiting = room.waiting.filter(g => g.id !== socket.id);
        io.to(room.hostId).emit('waiting-list-update', { waitingList: room.waiting });
      }
      room.admitted.delete(socket.id);

      if (room.hostId === socket.id) {
        const remaining = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
          .filter(id => id !== socket.id && !io.sockets.sockets.get(id)?.data?.waiting);
        if (remaining.length > 0) {
          room.hostId = remaining[0];
          io.to(roomId).emit('host-update', { hostId: room.hostId });
        } else {
          delete rooms[roomId];
        }
      }
      socket.to(roomId).emit('user-left', { id: socket.id });
    }
    console.log('Disconnected:', socket.id, socket.user.name);
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT} - REAL JWT MODE (Turso)`));