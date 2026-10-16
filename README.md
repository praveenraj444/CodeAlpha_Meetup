# 🎥 MeetUp — Real-Time Video Communication App

> A full-stack video conferencing web application built with WebRTC, Socket.io, React, Node.js, and Google OAuth. Features multi-user video calling, screen sharing, whiteboard, real-time chat, file sharing, waiting room, and comprehensive host controls.

![CodeAlpha](https://img.shields.io/badge/CodeAlpha-Internship-purple)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![React](https://img.shields.io/badge/react-18-blue)

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Google OAuth Setup](#-google-oauth-setup)
- [Database](#-database)
- [API Endpoints](#-api-endpoints)
- [Socket Events](#-socket-events)
- [Screenshots](#-screenshots)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Author](#-author)
- [Acknowledgements](#-acknowledgements)

---

## 🎯 About the Project

**MeetUp** is a **Real-Time Communication App** developed as **Task 4** of the **CodeAlpha Full Stack Development Internship**.

It is a production-ready video conferencing platform that allows users to create or join rooms, communicate via video/audio, share screens, collaborate on a whiteboard, share files, and chat in real-time. The app includes a comprehensive **host control panel** for managing participants and room settings.

### Why MeetUp?

- **Zero installation** — runs entirely in the browser using WebRTC
- **Google OAuth** — one-click sign-in with Gmail
- **Host controls** — mute all, block chat, stop screen share, waiting room, kick, lock room
- **Cloud-native** — Turso (cloud SQLite), Cloudinary (file storage), Render (hosting)
- **Secure** — JWT authentication + Google ID token verification

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| **Frontend** | [https://meetup-frontend-q8aq.onrender.com](https://meetup-backend-9go3.onrender.com/) |
| **Backend API** | [https://meetup-backend.onrender.com ](https://meetup-backend-9go3.onrender.com/)|

> ⚠️ **Note:** Hosted on Render's free tier. First request may take **30-60 seconds** due to cold start.

---

## ✨ Features

### 🔐 Authentication
- **Google OAuth 2.0** — Sign in with Google (Gmail)
- **Email/Password** — Traditional registration & login
- **Auto-linking** — Same email across Google & password auto-links to a single account
- **JWT-based sessions** — Secure, stateless auth
- **Profile pictures** — Google profile pic shown in app

### 📹 Video Communication
- **Multi-user video calling** — WebRTC peer-to-peer via `simple-peer`
- **Audio & video toggle** — Independent mic/camera controls
- **Active participants grid** — Auto-layout for multiple users
- **Network quality indicator** — Signal bars per participant

### 🖥️ Collaboration
- **Screen sharing** — Share your screen with all participants
- **Whiteboard** — Collaborative drawing canvas
- **Real-time chat** — Text messaging within the room
- **File sharing** — Share files via Cloudinary (images, PDFs, documents)
- **Emoji reactions** — Floating emoji reactions
- **Raise hand** — Non-verbal queue indicator

### 👑 Host Controls
- **Waiting Room** — Admit/deny guests before they join
- **Mute All / Unmute All** — Control participant audio
- **Video Off All / Allow Video** — Control participant cameras
- **Block Chat / Allow Chat** — Toggle text chat
- **Block Reactions / Allow Reactions** — Toggle emoji reactions
- **Block Screen Share / Allow** — Toggle screen sharing
- **Stop All Screen Shares** — Force-stop active shares
- **Lock Room** — Prevent new participants from joining
- **Kick User** — Remove specific participant
- **End Room** — Close the meeting for everyone

### 🔒 Security
- **JWT authentication** — Every socket connection verified
- **Google ID token verification** — Server-side validation
- **CORS protection** — Only allowed origins
- **Environment variables** — No secrets in code
- **Password hashing** — bcryptjs with salt rounds

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite 5** | Build tool & dev server |
| **React Router DOM 6** | Client-side routing |
| **Tailwind CSS 3** | Utility-first styling |
| **Lucide React** | Icon library |
| **Socket.io Client 4** | Real-time communication |
| **simple-peer 9** | WebRTC wrapper |
| **@react-oauth/google** | Google OAuth integration |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 18+** | Runtime |
| **Express 4** | HTTP server & REST API |
| **Socket.io 4** | Real-time bidirectional events |
| **@libsql/client** | Turso (cloud SQLite) client |
| **jsonwebtoken** | JWT auth |
| **bcryptjs** | Password hashing |
| **google-auth-library** | Google ID token verification |
| **multer** | File upload middleware |
| **cloudinary** | Cloud file storage |
| **cors** | Cross-origin resource sharing |
| **dotenv** | Environment variable loading |

### Infrastructure
| Service | Purpose |
|---|---|
| **Turso** | Cloud SQLite database (persistent) |
| **Cloudinary** | File storage (images, docs) |
| **Render** | Hosting (frontend + backend) |
| **Google Cloud** | OAuth 2.0 provider |
| **WebRTC** | Peer-to-peer media streaming |
| **STUN (Google)** | NAT traversal |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     USER BROWSER                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  React + Vite (Render Static Site)                │  │
│  │  - VideoRoom.jsx  - Chat.jsx  - Whiteboard.jsx    │  │
│  │  - Socket.io Client  - simple-peer (WebRTC)       │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│           ┌──────────────┼──────────────┐               │
│           │              │              │               │
│           ▼              ▼              ▼               │
│    ┌──────────┐   ┌──────────┐   ┌──────────┐          │
│    │ REST API │   │ WebSocket│   │ WebRTC   │          │
│    │  (HTTPS) │   │(Socket.io│   │(P2P Media)│         │
│    └──────────┘   └──────────┘   └──────────┘          │
└───────────┬──────────────┬──────────────┬───────────────┘
            │              │              │
            ▼              ▼              ▼
    ┌─────────────────────────────────────────┐
    │      Render Web Service (Node.js)       │
    │  - Express  - Socket.io  - JWT Auth     │
    │  - Google OAuth verify                  │
    │  - Cloudinary upload proxy              │
    └──────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌──────────┐
   │ Turso  │ │Cloudin-│ │ Google   │
   │(SQLite)│ │  ary   │ │ OAuth    │
   └────────┘ └────────┘ └──────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** v9 or higher (comes with Node.js)
- **Git** — [Download](https://git-scm.com/)
- **Google Cloud account** — for OAuth
- **Turso account** — for database
- **Cloudinary account** — for file storage

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/praveenraj444/CodeAlpha_Meetup.git
cd CodeAlpha_Meetup
```

**2. Install backend dependencies**

```bash
cd server
npm install
```

**3. Install frontend dependencies**

```bash
cd ../client
npm install
```

**4. Set up environment variables** (see [Environment Variables](#-environment-variables))

**5. Start the backend server**

```bash
cd server
npm run dev
```

**6. Start the frontend (new terminal)**

```bash
cd client
npm run dev
```

**7. Open your browser**

```
http://localhost:5173
```

---

## 🔐 Environment Variables

### `server/.env`

```env
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Turso Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

### `client/.env`

```env
VITE_SERVER_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## 🔑 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a **new project**
3. Navigate to **APIs & Services → OAuth consent screen**
4. Choose **External** → fill app name, support email
5. Add scopes: `userinfo.email`, `userinfo.profile`
6. Add test users (your Gmail)
7. Navigate to **Credentials → Create Credentials → OAuth Client ID**
8. Application type: **Web application**
9. Add **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - `https://your-production-url.com`
10. Add **Authorized redirect URIs**:
    - `http://localhost:5173`
    - `https://your-production-url.com`
11. Copy **Client ID** and **Client Secret** to `.env` files

---

## 🗄️ Database

### Turso (Cloud SQLite)

**Why Turso?**
- Cloud SQLite with **persistent storage** (unlike Render's ephemeral filesystem)
- **Free tier:** 9 GB storage, 500M reads/month, 10M writes/month
- **SQLite syntax** — no major code changes from local SQLite
- **Global replication** — low latency

### Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,                              -- NULL for Google-only users
  google_id TEXT,                             -- Google unique ID
  avatar TEXT,                                -- Google profile pic URL
  provider TEXT DEFAULT 'local',              -- 'local' | 'google' | 'both'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Auto-migration

The server automatically runs migration on startup:
- Creates `users` table if not exists
- Adds missing columns (`google_id`, `avatar`, `provider`)
- **No data loss** — existing data preserved

---

## 📡 API Endpoints

### Auth Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register with email/password | ❌ |
| `POST` | `/api/auth/login` | Login with email/password | ❌ |
| `POST` | `/api/auth/google` | Login/Register with Google | ❌ |

### File Upload

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/upload` | Upload file to Cloudinary | ❌ |

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Server status |

**Example: Google Login**

```http
POST /api/auth/google
Content-Type: application/json

{
  "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}

Response:
{
  "user": {
    "id": 1,
    "name": "Praveen Raj",
    "email": "praveenrajm2021@gmail.com",
    "avatar": "https://lh3.googleusercontent.com/..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔌 Socket Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId, name }` | Join or create a room |
| `signal` | `{ to, signal }` | WebRTC signaling |
| `chat-message` | `{ text }` | Send text message |
| `file-share` | `{ url, name, size, type }` | Share file |
| `raise-hand` | `{ raised }` | Toggle hand raise |
| `send-reaction` | `{ emoji }` | Send emoji reaction |
| `host:admit` | `{ guestId }` | Admit waiting guest |
| `host:deny` | `{ guestId }` | Deny waiting guest |
| `host:mute-all` | — | Mute all participants |
| `host:video-off-all` | — | Turn off all cameras |
| `host:block-chat` | — | Block chat |
| `host:block-reactions` | — | Block reactions |
| `host:block-screenshare` | — | Block screen share |
| `host:stop-all-screenshare` | — | Stop active shares |
| `host:lock-room` | `{ locked }` | Lock/unlock room |
| `host:kick-user` | `{ targetId }` | Kick a user |
| `host:end-room` | — | End room for everyone |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `room-joined` | `{ users, hostId, ... }` | Room join confirmation |
| `waiting-room` | `{ roomId }` | Guest waiting notification |
| `user-joined` | `{ id, name }` | New user joined |
| `user-left` | `{ id }` | User left |
| `signal` | `{ from, name, signal }` | WebRTC signaling |
| `chat-message` | `{ id, senderId, name, text, time }` | Received message |
| `file-share` | `{ id, senderId, name, file, time }` | Received file |
| `hand-update` | `{ userId, raised }` | Hand raise update |
| `reaction` | `{ userId, name, emoji, id }` | Received reaction |
| `join-request` | `{ id, name }` | Host: new guest waiting |
| `waiting-list-update` | `{ waitingList }` | Waiting list changed |
| `force-mute` | — | Host muted you |
| `video-blocked` | `{ blocked }` | Video blocked/unblocked |
| `chat-blocked` | `{ blocked }` | Chat blocked/unblocked |
| `reactions-blocked` | `{ blocked }` | Reactions blocked/unblocked |
| `screenshare-blocked` | `{ blocked }` | Screen share blocked/unblocked |
| `force-screenshare-off` | — | Host stopped your share |
| `room-locked-update` | `{ locked }` | Room lock status changed |
| `kicked-out` | — | You were kicked |
| `room-ended` | — | Host ended the room |
| `host-update` | `{ hostId }` | New host assigned |

---

## 📸 Screenshots

> Add screenshots of your app here.

### Login Page
```
[Google Sign-In button + Email/Password form]
```

### Video Room
```
[Multi-user video grid + Host controls panel + Chat sidebar]
```

### Waiting Room
```
[Guest waiting screen + Host admit/deny panel]
```

### Whiteboard
```
[Collaborative drawing canvas]
```

---

## 🚀 Deployment

### Backend — Render

1. Create a **Web Service** on [Render](https://render.com/)
2. Connect your GitHub repository
3. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variables (see [Environment Variables](#-environment-variables))
5. Deploy

### Frontend — Render

1. Create a **Static Site** on [Render](https://render.com/)
2. Connect the same repository
3. Configure:
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add environment variables:
   - `VITE_SERVER_URL` = your backend URL
   - `VITE_GOOGLE_CLIENT_ID` = your Google Client ID
5. Deploy

### Database — Turso

1. Sign up at [turso.tech](https://turso.tech/)
2. Create a database: `meetup-db`
3. Copy the **URL** and create an **auth token**
4. Add to backend environment variables

### Post-deployment

- Update **backend `CLIENT_URL`** to your frontend URL
- Add **production URLs** to Google Cloud Console (origins + redirects)
- Redeploy frontend after env variable changes

---

## 📁 Project Structure

```
CodeAlpha_Meetup/
├── client/                          # React frontend
│   ├── public/
│   ├── src/
│   │   ├── App.jsx                  # Main app + routing + login page
│   │   ├── VideoRoom.jsx            # Video call room
│   │   ├── Chat.jsx                 # Chat sidebar
│   │   ├── Whiteboard.jsx           # Collaborative whiteboard
│   │   ├── config.js                # Environment config
│   │   ├── socket.js                # Socket.io client instance
│   │   ├── index.css                # Tailwind styles
│   │   └── main.jsx                 # Entry point + Google OAuth provider
│   ├── .env                         # Client env (not committed)
│   ├── .env.example                 # Env template
│   ├── index.html                   # HTML template
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                          # Node.js backend
│   ├── server.js                    # Main server file
│   ├── .env                         # Server env (not committed)
│   ├── .env.example                 # Env template
│   └── package.json
│
├── .gitignore
└── README.md                        # This file
```

---

## 👨‍💻 Author

**Praveen Raj M**

- GitHub: [@praveenraj444](https://github.com/praveenraj444)
- Email: praveenrajm2021@gmail.com
- LinkedIn: [Praveenraj M](https://linkedin.com/in/praveenrajm2021)

**CodeAlpha Full Stack Development Internship — Task 4**

---

## 🙏 Acknowledgements

- **[CodeAlpha](https://www.codealpha.tech/)** — For the internship opportunity and project guidelines
- **[WebRTC](https://webrtc.org/)** — Real-time peer-to-peer communication
- **[Socket.io](https://socket.io/)** — Real-time bidirectional events
- **[Turso](https://turso.tech/)** — Cloud SQLite database
- **[Cloudinary](https://cloudinary.com/)** — File storage & CDN
- **[Render](https://render.com/)** — Free hosting platform
- **[Google Cloud](https://cloud.google.com/)** — OAuth 2.0 provider
- **[Lucide](https://lucide.dev/)** — Beautiful icon set
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first CSS framework

---

## 📝 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## ⭐ Show Your Support

If you found this project helpful, please give it a ⭐ on GitHub!

---

<div align="center">

**Built with ❤️ by Praveen Raj M**

**CodeAlpha Full Stack Development Internship — Task 4: Real-Time Communication App**

</div>
