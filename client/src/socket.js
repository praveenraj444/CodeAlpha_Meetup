import { io } from "socket.io-client";
import { SERVER_URL } from "./config.js";

const socket = io(SERVER_URL, {
  autoConnect: false,        // manual connect (videoroom.jsx la call pandrom)
  transports: ['websocket', 'polling'],  // websocket first, polling fallback
  reconnection: true,        // auto reconnect on disconnect
  reconnectionAttempts: 10,  // max 10 tries
  reconnectionDelay: 1000,   // 1s delay between tries
  reconnectionDelayMax: 5000,// max 5s delay
  timeout: 20000,            // connection timeout
  auth: (cb) => {
    const token = localStorage.getItem('token');
    console.log("🔑 Sending token:", token ? "YES (" + token.slice(0, 20) + "...)" : "NO");
    cb({ token });
  }
});

// ===== DEBUG LOGS (helpful for development) =====
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server forcibly disconnected — manually reconnect
    socket.connect();
  }
});

socket.on('connect_error', (err) => {
  console.error('❌ Socket connect error:', err.message);
});

socket.on('reconnect', (attempt) => {
  console.log(`🔄 Socket reconnected after ${attempt} attempts`);
});

socket.on('reconnect_attempt', (attempt) => {
  console.log(`🔄 Reconnecting... attempt ${attempt}`);
});

socket.on('reconnect_failed', () => {
  console.error('❌ Socket reconnection failed');
});

export default socket;