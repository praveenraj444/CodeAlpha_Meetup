import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, createContext, useContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Video, Plus, LogIn, AlertCircle, LogOut, Crown, Shield } from 'lucide-react';
import VideoRoom from './VideoRoom.jsx';
import { SERVER_URL } from './config.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('meetup_user');
    return saved ? JSON.parse(saved) : null;
  });
  const login = (userData) => {
    localStorage.setItem('meetup_user', JSON.stringify(userData));
    localStorage.setItem('name', userData.name);
    localStorage.setItem('token', userData.token);
    setUser(userData);
  };
  const logout = () => {
    localStorage.removeItem('meetup_user');
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim() || !password.trim() || (isSignup && !name.trim())) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      const url = isSignup 
        ? `${SERVER_URL}/api/auth/register` 
        : `${SERVER_URL}/api/auth/login`;

      const body = isSignup ? { name, email, password } : { email, password };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.msg || 'Failed');

      const userData = { 
        id: data.user.id, 
        name: data.user.name, 
        email: data.user.email, 
        token: data.token 
      };
      
      login(userData);
      navigate('/');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== GOOGLE LOGIN HANDLER =====
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google login failed');

      const userData = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        avatar: data.user.avatar || null,
        token: data.token
      };

      login(userData);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/60 to-gray-900 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-500"><Shield className="h-6 w-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold">{isSignup ? 'Create Account' : 'Welcome Back'}</h1><p className="text-sm text-gray-400">{isSignup ? 'Join MeetUp now' : 'Login to MeetUp'}</p></div>
        </div>

        {/* ===== GOOGLE LOGIN BUTTON ===== */}
        <div className="mb-5 flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            size="large"
            shape="pill"
            text="continue_with"
            width="320"
          />
        </div>

        {/* ===== DIVIDER ===== */}
        <div className="my-5 flex items-center gap-3 text-xs uppercase text-gray-500">
          <span className="h-px flex-1 bg-gray-800" /> or <span className="h-px flex-1 bg-gray-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-purple-500" />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-purple-500" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-purple-500" />
          {error && <p className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" /> {error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 font-semibold hover:bg-purple-400 disabled:opacity-50">
            {loading ? 'Please wait...' : (isSignup ? 'Sign Up' : 'Login')} <LogIn className="h-5 w-5" />
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">{isSignup ? 'Already have account?' : 'No account yet?'} <button onClick={() => setIsSignup(!isSignup)} className="text-purple-400 hover:underline">{isSignup ? 'Login' : 'Sign Up'}</button></p>
      </div>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const go = (id, isHost = false) => {
    if (isHost) localStorage.setItem(`host_${id}`, user.id);
    localStorage.setItem('name', user.name);
    navigate(`/room/${id}`, { state: { isHost } });
  };
  const create = () => { const id = Math.random().toString(36).slice(2, 10); go(id, true); };
  const join = (e) => { e.preventDefault(); if (!roomId.trim()) return setError('Please enter Room ID'); go(roomId.trim(), false); };
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/60 to-gray-900 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-500"><Video className="h-6 w-6 text-white" /></div><div><h1 className="text-2xl font-bold">MeetUp</h1><p className="text-sm text-gray-400">Hi, {user.name} 👋</p></div></div><button onClick={logout} className="rounded-xl border border-gray-700 p-2 text-gray-400 hover:bg-gray-800"><LogOut className="h-5 w-5" /></button></div>
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300"><Crown className="h-4 w-4" /> You are Host if you create room</div>
        <button onClick={create} className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 font-semibold hover:bg-purple-400"><Plus className="h-5 w-5" /> Create New Room (As Host)</button>
        <div className="my-5 flex items-center gap-3 text-xs uppercase text-gray-500"><span className="h-px flex-1 bg-gray-800" /> or join <span className="h-px flex-1 bg-gray-800" /></div>
        <form onSubmit={join} className="flex flex-col gap-3 sm:flex-row"><input value={roomId} onChange={(e) => { setRoomId(e.target.value); setError(''); }} placeholder="Enter Room ID" className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-purple-500" /><button className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/50 bg-purple-500/10 px-5 py-3 font-semibold text-purple-300"><LogIn className="h-5 w-5" /> Join</button></form>
        {error && <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" /> {error}</p>}
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/room/:roomId" element={<ProtectedRoute><VideoRoom /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}