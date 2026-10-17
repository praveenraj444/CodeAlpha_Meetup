import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Peer from 'simple-peer/simplepeer.min.js';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, PenTool,
  MessageSquare, PhoneOff, Copy, Check, Users, Loader2, AlertTriangle,
  Crown, UserX, Mic2, XOctagon, ScreenShareOff, Hand,
  Smile, SmilePlus, Signal, UserCheck, UserX2, Clock, Lock, Unlock,
  Share2, QrCode, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Chat from './Chat.jsx';
import Whiteboard from './Whiteboard.jsx';
import socket from "./socket.js";

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

function getQualityFromState(state) {
  if (!state) return { color: 'bg-gray-500', label: 'Unknown', bars: 0 };
  if (state === 'connected' || state === 'completed') return { color: 'bg-green-500', label: 'Good', bars: 4 };
  if (state === 'checking' || state === 'new') return { color: 'bg-yellow-500', label: 'Connecting', bars: 2 };
  if (state === 'disconnected') return { color: 'bg-orange-500', label: 'Weak', bars: 1 };
  if (state === 'failed' || state === 'closed') return { color: 'bg-red-500', label: 'Bad', bars: 0 };
  return { color: 'bg-gray-500', label: 'Unknown', bars: 0 };
}

function NetworkBars({ quality }) {
  return (
    <div className="flex items-end gap-0.5" title={`Network: ${quality.label}`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1 rounded-sm ${i <= quality.bars ? quality.color : 'bg-gray-600'}`}
          style={{ height: `${i * 3 + 3}px` }}
        />
      ))}
    </div>
  );
}

function Tile({ stream, name, muted, mirror, camOff, isHost, handRaised, quality }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <div className={`relative aspect-video overflow-hidden rounded-2xl border bg-gray-900 shadow-lg ${handRaised ? 'border-yellow-400 ring-2 ring-yellow-400/50' : 'border-gray-700'}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className={`h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}`} />
      {!stream && (
        <div className="absolute inset-0 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>
      )}
      {camOff && (
        <div className="absolute inset-0 grid place-items-center bg-gray-900">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-purple-600 text-3xl font-semibold">{name?.[0]?.toUpperCase()}</div>
        </div>
      )}
      {handRaised && (
        <div className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-yellow-500 text-black shadow-lg animate-bounce">
          <Hand className="h-4 w-4" />
        </div>
      )}
      <span className="absolute bottom-3 left-3 flex items-center gap-1 max-w-[80%] truncate rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium backdrop-blur">
        {isHost && <Crown className="h-3 w-3 text-yellow-400" />} {name}
      </span>
      {quality && (
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 backdrop-blur">
          <NetworkBars quality={quality} />
        </span>
      )}
    </div>
  );
}

function Btn({ onClick, tone = 'default', label, disabled, children }) {
  const tones = {
    default: 'bg-white/10 hover:bg-white/20',
    off: 'bg-red-500/90 hover:bg-red-500',
    on: 'bg-purple-500 hover:bg-purple-400',
    danger: 'bg-red-600 hover:bg-red-500 w-14',
    hand: 'bg-yellow-500 hover:bg-yellow-400',
    blocked: 'bg-gray-700/50 cursor-not-allowed opacity-50',
  };
  return (
    <button onClick={onClick} title={label} aria-label={label} disabled={disabled}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white transition active:scale-95 ${tones[disabled ? 'blocked' : tone]}`}>
      {children}
    </button>
  );
}

export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const userData = JSON.parse(localStorage.getItem('meetup_user') || 'null');
  const nameRef = useRef(userData?.name || localStorage.getItem('name') || `Guest-${Math.floor(Math.random() * 9000 + 1000)}`);
  const name = nameRef.current;

  const [peers, setPeers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showQR, setShowQR] = useState(false); // 👈 NEW

  const [hostId, setHostId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [hostMuted, setHostMuted] = useState(false);
  const [videoBlocked, setVideoBlocked] = useState(false);
  const [chatBlocked, setChatBlocked] = useState(false);
  const [screenShareBlocked, setScreenShareBlocked] = useState(false);
  const [reactionsBlocked, setReactionsBlocked] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);

  const [waiting, setWaiting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [waitingList, setWaitingList] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState({});
  const [reactions, setReactions] = useState([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const peersRef = useRef({});
  const camStreamRef = useRef(null);
  const outStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const hasJoinedRef = useRef(false);

  const isHostRef = useRef(isHost);
  const blockRef = useRef(screenShareBlocked);
  const sharingRef = useRef(sharing);
  const reactionsBlockedRef = useRef(reactionsBlocked);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { blockRef.current = screenShareBlocked; }, [screenShareBlocked]);
  useEffect(() => { sharingRef.current = sharing; }, [sharing]);
  useEffect(() => { reactionsBlockedRef.current = reactionsBlocked; }, [reactionsBlocked]);

  const stopShare = () => {
    const screenTrack = screenTrackRef.current;
    const cam = camStreamRef.current?.getVideoTracks()[0];
    if (!screenTrack || !cam) { setSharing(false); return; }
    Object.values(peersRef.current).forEach((p) => {
      try { p.replaceTrack(screenTrack, cam, outStreamRef.current); } catch {}
    });
    screenTrack.onended = null;
    screenTrack.stop();
    screenTrackRef.current = null;
    outStreamRef.current = camStreamRef.current;
    setPreview(camStreamRef.current);
    setSharing(false);
  };

  const startShare = async () => {
    if (blockRef.current && !isHostRef.current) {
      setError('🚫 Host has blocked screen sharing for guests');
      setTimeout(() => setError(''), 3000);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      const cam = camStreamRef.current.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((p) => {
        try { p.replaceTrack(cam, screenTrack, outStreamRef.current); } catch {}
      });
      screenTrackRef.current = screenTrack;
      const shared = new MediaStream([screenTrack, ...camStreamRef.current.getAudioTracks()]);
      outStreamRef.current = shared;
      setPreview(shared);
      screenTrack.onended = stopShare;
      setSharing(true);
    } catch (e) {
      if (e.name !== 'NotAllowedError') setError('Screen sharing failed.');
    }
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    socket.emit('raise-hand', { raised: next });
  };

  const sendReaction = (emoji) => {
    if (reactionsBlocked && !isHost) {
      setError('🚫 Host has blocked reactions');
      setTimeout(() => setError(''), 3000);
      setShowReactionPicker(false);
      return;
    }
    socket.emit('send-reaction', { emoji });
    setShowReactionPicker(false);
  };

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    setError('');
    setLoading(true);

    const removePeer = (id) => {
      peersRef.current[id]?.destroy();
      delete peersRef.current[id];
      setPeers((p) => p.filter((x) => x.id !== id));
    };

    const createPeer = (id, peerName, initiator) => {
      const peer = new Peer({ initiator, trickle: true, stream: outStreamRef.current, config: ICE });
      peer.on('signal', (signal) => socket.emit('signal', { to: id, signal }));
      peer.on('stream', (remote) =>
        setPeers((p) => p.map((x) => (x.id === id ? { ...x, stream: remote } : x)))
      );
      peer.on('close', () => removePeer(id));
      peer.on('error', () => removePeer(id));
      peer.on('iceStateChange', (state) => {
        const q = getQualityFromState(state);
        setPeers((p) => p.map((x) => (x.id === id ? { ...x, quality: q, iceState: state } : x)));
      });
      peersRef.current[id] = peer;
      setPeers((p) => (p.some((x) => x.id === id) ? p.map((x) => x.id === id ? { ...x, name: peerName } : x) : [...p, { id, name: peerName, stream: null, quality: null, iceState: null }]));
      return peer;
    };

    socket.on('connect_error', (err) => {
      console.log("Socket error:", err.message);
      setError(err.message + ' - Please login again');
      if (err.message.includes('token')) { localStorage.clear(); navigate('/login'); }
    });

    socket.on('waiting-room', () => {
      console.log('⏳ Entered waiting room');
      setWaiting(true);
      setLoading(false);
    });

    socket.on('join-denied', () => {
      setWaiting(false);
      setDenied(true);
    });

    socket.on('room-locked', () => {
      setError('🔒 Room is locked by host');
      setTimeout(() => navigate('/'), 2000);
    });

    socket.on('room-locked-update', ({ locked }) => {
      setRoomLocked(!!locked);
    });

    socket.on('join-request', (guest) => {
      console.log('🔔 Join request:', guest);
      setWaitingList((w) => w.some((g) => g.id === guest.id) ? w : [...w, guest]);
    });

    socket.on('waiting-list-update', ({ waitingList: wl }) => {
      setWaitingList(wl);
    });

    socket.on('room-joined', ({ users, hostId: hId, youAreHost, chatBlocked: cb, videoBlocked: vb, screenShareBlocked: sb, reactionsBlocked: rb, waitingList: wl }) => {
      console.log('🔔 room-joined received:', { users, hId, youAreHost, cb, vb, sb, rb });
      hasJoinedRef.current = true;
      setWaiting(false);
      setDenied(false);
      setHostId(hId);
      setIsHost(youAreHost);
      setChatBlocked(!!cb);
      setVideoBlocked(!!vb);
      setScreenShareBlocked(!!sb);
      setReactionsBlocked(!!rb);
      if (wl) setWaitingList(wl);
      users.forEach((u) => {
        if (!peersRef.current[u.id]) {
          createPeer(u.id, u.name, true);
        }
      });
    });

    socket.on('user-joined', ({ id, name: peerName }) => {
      console.log('🔔 user-joined received:', { id, peerName });
      if (!hasJoinedRef.current) return;
      setPeers((p) => (p.some((x) => x.id === id) ? p : [...p, { id, name: peerName, stream: null, quality: null, iceState: null }]));
    });

    socket.on('host-update', ({ hostId: hId }) => {
      setHostId(hId);
      setIsHost(socket.id === hId);
    });

    socket.on('signal', ({ from, name: peerName, signal }) => {
      const peer = peersRef.current[from] || createPeer(from, peerName, false);
      peer.signal(signal);
    });

    socket.on('user-left', ({ id }) => {
      removePeer(id);
      setRaisedHands((h) => { const n = { ...h }; delete n[id]; return n; });
    });

    socket.on('kicked-out', () => { alert('You were removed by host'); navigate('/'); });
    socket.on('room-ended', () => { alert('Host ended the room'); navigate('/'); });

    socket.on('force-mute', () => {
      const t = camStreamRef.current?.getAudioTracks()[0];
      if (t) { t.enabled = false; setMicOn(false); setHostMuted(true); }
    });

    socket.on('host-unmute-all', () => setHostMuted(false));

    socket.on('force-video-off', () => {
      const t = camStreamRef.current?.getVideoTracks()[0];
      if (t) { t.enabled = false; setCamOn(false); }
    });

    socket.on('video-blocked', ({ blocked }) => {
      setVideoBlocked(!!blocked);
      if (blocked) {
        const t = camStreamRef.current?.getVideoTracks()[0];
        if (t && t.enabled) { t.enabled = false; setCamOn(false); }
      }
    });

    socket.on('chat-blocked', ({ blocked }) => setChatBlocked(!!blocked));

    socket.on('reactions-blocked', ({ blocked }) => {
      setReactionsBlocked(!!blocked);
      if (blocked) setShowReactionPicker(false);
    });

    socket.on('screenshare-blocked', ({ blocked }) => {
      setScreenShareBlocked(!!blocked);
      if (blocked && sharingRef.current) {
        const screenTrack = screenTrackRef.current;
        const cam = camStreamRef.current?.getVideoTracks()[0];
        if (screenTrack && cam) {
          Object.values(peersRef.current).forEach((p) => {
            try { p.replaceTrack(screenTrack, cam, outStreamRef.current); } catch {}
          });
          screenTrack.onended = null;
          screenTrack.stop();
          screenTrackRef.current = null;
          outStreamRef.current = camStreamRef.current;
          setPreview(camStreamRef.current);
          setSharing(false);
        }
      }
    });

    socket.on('force-screenshare-off', () => {
      const screenTrack = screenTrackRef.current;
      const cam = camStreamRef.current?.getVideoTracks()[0];
      if (screenTrack && cam) {
        Object.values(peersRef.current).forEach((p) => {
          try { p.replaceTrack(screenTrack, cam, outStreamRef.current); } catch {}
        });
        screenTrack.onended = null;
        screenTrack.stop();
        screenTrackRef.current = null;
        outStreamRef.current = camStreamRef.current;
        setPreview(camStreamRef.current);
        setSharing(false);
        setError('🛑 Host stopped your screen share');
        setTimeout(() => setError(''), 3000);
      }
    });

    socket.on('hand-update', ({ userId, raised }) => {
      setRaisedHands((h) => ({ ...h, [userId]: raised }));
    });

    socket.on('reaction', ({ userId, name: rname, emoji, id }) => {
      setReactions((r) => [...r, { id, emoji, name: rname, userId }]);
      setTimeout(() => {
        setReactions((r) => r.filter((x) => x.id !== id));
      }, 3500);
    });

    (async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        if (!cancelled) {
          setError(e.name === 'NotAllowedError' ? 'Camera/microphone permission denied.' : 'Could not access camera/mic.');
          setLoading(false);
        }
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      camStreamRef.current = stream;
      outStreamRef.current = stream;
      setPreview(stream);

      socket.connect();
      socket.on('connect', () => {
        console.log("Socket connected with real token!");
        socket.emit('join-room', { roomId, name });
      });

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      Object.values(peersRef.current).forEach((p) => p.destroy());
      peersRef.current = {};
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      ['connect','connect_error','waiting-room','join-denied','room-locked','room-locked-update','join-request','waiting-list-update','room-joined','user-joined','host-update','signal','user-left','kicked-out','room-ended','force-mute','host-unmute-all','force-video-off','video-blocked','chat-blocked','reactions-blocked','screenshare-blocked','force-screenshare-off','hand-update','reaction']
        .forEach((ev) => socket.off(ev));
      socket.disconnect();
      setPeers([]);
      setSharing(false);
    };
  }, [roomId, name, attempt, navigate]);

  const toggleMic = () => {
    if (hostMuted && !isHost && !micOn) {
      setError('Host muted you. Wait for host to allow.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const t = camStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicOn(t.enabled);
  };

  const toggleCam = () => {
    if (videoBlocked && !isHost && !camOn) {
      setError('Host turned off video. Wait for host.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const t = camStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOn(t.enabled);
  };

  const kickUser = (id) => { if (!isHost) return; socket?.emit('host:kick-user', { targetId: id }); };
  const muteAll = () => { if (!isHost) return; socket?.emit('host:mute-all'); };
  const unmuteAll = () => { if (!isHost) return; socket?.emit('host:unmute-all'); };
  const videoOffAll = () => { if (!isHost) return; socket?.emit('host:video-off-all'); };
  const allowVideo = () => { if (!isHost) return; socket?.emit('host:allow-video'); };
  const blockChat = () => { if (!isHost) return; socket?.emit('host:block-chat'); };
  const allowChat = () => { if (!isHost) return; socket?.emit('host:allow-chat'); };
  const blockScreenShare = () => { if (!isHost) return; socket?.emit('host:block-screenshare'); };
  const allowScreenShare = () => { if (!isHost) return; socket?.emit('host:allow-screenshare'); };
  const stopAllScreenShare = () => { if (!isHost) return; socket?.emit('host:stop-all-screenshare'); };

  const blockReactions = () => { if (!isHost) return; socket?.emit('host:block-reactions'); };
  const allowReactions = () => { if (!isHost) return; socket?.emit('host:allow-reactions'); };

  const endRoom = () => { if (!isHost) return; if (confirm('End room for everyone?')) socket?.emit('host:end-room'); };
  const leave = () => navigate('/');
  
  // 👈 NEW: Room ID Copy Function
  const copyId = async () => {
    try { await navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  // 👈 NEW: Share Link Function
  const shareRoom = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`;
    const shareData = {
      title: 'Join my MeetUp room',
      text: `Join my video call on MeetUp! Room ID: ${roomId}`,
      url: roomLink
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(roomLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Share failed:', err);
    }
  };

  // 👈 NEW: Copy Link Function (QR Modal ku)
  const copyLink = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const admitGuest = (guestId) => socket.emit('host:admit', { guestId });
  const denyGuest = (guestId) => socket.emit('host:deny', { guestId });
  const toggleLock = () => socket.emit('host:lock-room', { locked: !roomLocked });

  if (waiting) {
    return (
      <div className="grid min-h-full place-items-center bg-gray-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-gray-900 p-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-purple-500/20">
            <Clock className="h-8 w-8 text-purple-400 animate-pulse" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">Waiting for host to admit you</h2>
          <p className="mb-6 text-sm text-gray-400">The host will let you in shortly...</p>
          <div className="flex justify-center">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
          <button onClick={() => navigate('/')} className="mt-6 rounded-xl bg-white/10 px-5 py-2.5 text-sm hover:bg-white/20">Cancel</button>
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="grid min-h-full place-items-center bg-gray-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-gray-900 p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-xl font-semibold text-white">Entry Denied</h2>
          <p className="mb-6 text-sm text-gray-400">Host did not admit you to this room.</p>
          <button onClick={() => navigate('/')} className="rounded-xl bg-purple-500 px-5 py-2.5 font-semibold hover:bg-purple-400">Back to Home</button>
        </div>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="grid min-h-full place-items-center bg-gray-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-gray-900 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <p className="mb-5 text-gray-300">{error}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setAttempt((a) => a + 1)} className="rounded-xl bg-purple-500 px-5 py-2.5 font-semibold hover:bg-purple-400">Retry</button>
            <button onClick={leave} className="rounded-xl bg-white/10 px-5 py-2.5 hover:bg-white/20">Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {reactions.map((r, i) => (
          <div
            key={r.id}
            className="absolute text-4xl animate-[floatUp_3.5s_ease-out_forwards]"
            style={{ left: `${15 + (i % 6) * 13}%`, bottom: '100px' }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      <header className="flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-900/70 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500"><Video className="h-4 w-4" /></div>
          <span className="truncate text-sm text-gray-400">Room:</span>
          <code className="truncate rounded-md bg-gray-800 px-2 py-0.5 text-sm text-purple-300">{roomId}</code>
          
          {/* 👈 NEW: Copy ID */}
          <button onClick={copyId} title="Copy room ID" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
          
          {/* 👈 NEW: Share Link */}
          <button onClick={shareRoom} title="Share room link" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
            <Share2 className="h-4 w-4" />
          </button>
          
          {/* 👈 NEW: QR Code */}
          <button onClick={() => setShowQR(true)} title="Show QR code" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
            <QrCode className="h-4 w-4" />
          </button>

          {isHost && <span className="ml-2 flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300"><Crown className="h-3 w-3" /> Host</span>}
          {screenShareBlocked && <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">Share Blocked</span>}
          {reactionsBlocked && <span className="ml-2 flex items-center gap-1 rounded-full bg-pink-500/20 px-2 py-0.5 text-xs text-pink-300"><SmilePlus className="h-3 w-3" /> Reactions Off</span>}
          {roomLocked && <span className="ml-2 flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300"><Lock className="h-3 w-3" /> Locked</span>}
        </div>
        <div className="flex items-center gap-2">
          {isHost && waitingList.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-1 text-xs text-green-300 animate-pulse">
              <Users className="h-3 w-3" /> {waitingList.length} waiting
            </span>
          )}
          {isHost && <button onClick={() => setShowHostPanel(!showHostPanel)} className="rounded-full bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300 hover:bg-yellow-500/20"><Crown className="mr-1 inline h-3 w-3" /> Controls</button>}
          <span className="flex items-center gap-1.5 text-sm text-gray-400"><Users className="h-4 w-4" /> {peers.length + 1}</span>
        </div>
      </header>

      {error && <div className="bg-red-500/10 px-4 py-2 text-center text-sm text-red-400">{error}</div>}

      {showHostPanel && isHost && (
        <div className="border-b border-yellow-500/20 bg-yellow-950/20 p-3">
          <div className="mx-auto max-w-7xl">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow-300"><Crown className="h-4 w-4" /> Host Controls</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={muteAll} className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs hover:bg-gray-700"><Mic2 className="h-3 w-3" /> Mute All Mic</button>
              <button onClick={unmuteAll} className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs hover:bg-gray-700">Allow Mic</button>
              <button onClick={videoOffAll} className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs hover:bg-gray-700"><VideoOff className="h-3 w-3" /> Video Off All</button>
              <button onClick={allowVideo} className="flex items-center gap-1 rounded-lg bg-green-800 px-3 py-1.5 text-xs hover:bg-green-700"><Video className="h-3 w-3" /> Allow Video</button>
              <button onClick={blockChat} className="flex items-center gap-1 rounded-lg bg-orange-800 px-3 py-1.5 text-xs hover:bg-orange-700"><MessageSquare className="h-3 w-3" /> Block Chat</button>
              <button onClick={allowChat} className="flex items-center gap-1 rounded-lg bg-green-800 px-3 py-1.5 text-xs hover:bg-green-700"><MessageSquare className="h-3 w-3" /> Allow Chat</button>

              <button onClick={blockReactions} className="flex items-center gap-1 rounded-lg bg-pink-800 px-3 py-1.5 text-xs hover:bg-pink-700"><SmilePlus className="h-3 w-3" /> Block Reactions</button>
              <button onClick={allowReactions} className="flex items-center gap-1 rounded-lg bg-green-800 px-3 py-1.5 text-xs hover:bg-green-700"><Smile className="h-3 w-3" /> Allow Reactions</button>

              <button onClick={blockScreenShare} className="flex items-center gap-1 rounded-lg bg-orange-800 px-3 py-1.5 text-xs hover:bg-orange-700"><ScreenShareOff className="h-3 w-3" /> Block Share</button>
              <button onClick={allowScreenShare} className="flex items-center gap-1 rounded-lg bg-green-800 px-3 py-1.5 text-xs hover:bg-green-700"><MonitorUp className="h-3 w-3" /> Allow Share</button>
              <button onClick={stopAllScreenShare} className="flex items-center gap-1 rounded-lg bg-red-800 px-3 py-1.5 text-xs hover:bg-red-700"><MonitorOff className="h-3 w-3" /> Stop All Share</button>
              <button onClick={toggleLock} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs ${roomLocked ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                {roomLocked ? <><Lock className="h-3 w-3" /> Unlock Room</> : <><Unlock className="h-3 w-3" /> Lock Room</>}
              </button>
              <button onClick={endRoom} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs hover:bg-red-500"><XOctagon className="h-3 w-3" /> End for All</button>
            </div>

            {waitingList.length > 0 && (
              <div className="mb-3 rounded-xl border border-green-500/30 bg-green-950/20 p-3">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-green-300">
                  <Clock className="h-3 w-3" /> Waiting Room ({waitingList.length})
                </h4>
                <div className="grid gap-1">
                  {waitingList.map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm">
                      <span>{g.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => admitGuest(g.id)} className="flex items-center gap-1 rounded bg-green-500/20 px-2 py-1 text-xs text-green-300 hover:bg-green-500/30"><UserCheck className="h-3 w-3" /> Admit</button>
                        <button onClick={() => denyGuest(g.id)} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30"><UserX2 className="h-3 w-3" /> Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-1">
              {peers.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {p.name} {p.id === hostId && '(Host)'}
                    {raisedHands[p.id] && <Hand className="h-3 w-3 text-yellow-400" />}
                  </span>
                  <button onClick={() => kickUser(p.id)} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30"><UserX className="h-3 w-3" /> Kick</button>
                </div>
              ))}
              {peers.length === 0 && <p className="text-xs text-gray-500">No other users yet</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <div className="h-full overflow-y-auto p-3 pb-28">
            {loading ? (
              <div className="grid h-full place-items-center"><Loader2 className="h-10 w-10 animate-spin text-purple-500" /></div>
            ) : (
              <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Tile stream={preview} name={`${name} (You)`} muted mirror={!sharing} camOff={!camOn && !sharing} isHost={isHost} handRaised={handRaised} />
                {peers.map((p) => (
                  <Tile key={p.id} stream={p.stream} name={p.name} isHost={p.id === hostId} handRaised={!!raisedHands[p.id]} quality={p.quality} />
                ))}
              </div>
            )}
          </div>
          <Whiteboard socket={socket} visible={boardOpen} onClose={() => setBoardOpen(false)} />
        </div>
        <Chat socket={socket} open={chatOpen} onClose={() => setChatOpen(false)} blocked={chatBlocked && !isHost} />
      </div>

      {showReactionPicker && (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-gray-900/95 p-2 shadow-2xl backdrop-blur">
          <div className="flex gap-1">
            {['👍','❤️','😂','🎉','👏','🔥','😮','🙏'].map((e) => (
              <button key={e} onClick={() => sendReaction(e)} className="grid h-11 w-11 place-items-center rounded-full text-2xl hover:bg-white/10 active:scale-90 transition">{e}</button>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-3">
        <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-white/10 p-2 shadow-2xl backdrop-blur-xl sm:gap-3 sm:p-3">
          <Btn onClick={toggleMic} tone={micOn ? 'default' : 'off'} label={micOn ? 'Mute' : 'Unmute'}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</Btn>
          <Btn onClick={toggleCam} tone={camOn ? 'default' : 'off'} label={camOn ? 'Turn video off' : 'Turn video on'}>{camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</Btn>
          <Btn onClick={sharing ? stopShare : startShare} tone={sharing ? 'on' : 'default'} disabled={screenShareBlocked && !isHost && !sharing} label={screenShareBlocked && !isHost ? 'Blocked by host' : sharing ? 'Stop sharing' : 'Share screen'}>{sharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}</Btn>
          <Btn onClick={toggleHand} tone={handRaised ? 'hand' : 'default'} label={handRaised ? 'Lower hand' : 'Raise hand'}>
            <Hand className={`h-5 w-5 ${handRaised ? 'text-black' : ''}`} />
          </Btn>
          <Btn
            onClick={() => setShowReactionPicker((v) => !v)}
            tone={showReactionPicker ? 'on' : 'default'}
            disabled={reactionsBlocked && !isHost}
            label={reactionsBlocked && !isHost ? 'Reactions blocked by host' : 'Reactions'}
          >
            <SmilePlus className="h-5 w-5" />
          </Btn>
          <Btn onClick={() => setBoardOpen((v) => !v)} tone={boardOpen ? 'on' : 'default'} label="Whiteboard"><PenTool className="h-5 w-5" /></Btn>
          <Btn onClick={() => setChatOpen((v) => !v)} tone={chatOpen ? 'on' : 'default'} label="Chat"><MessageSquare className="h-5 w-5" /></Btn>
          <Btn onClick={leave} tone="danger" label="Leave room"><PhoneOff className="h-5 w-5" /></Btn>
        </div>
      </nav>

      {/* 👈 NEW: QR Code Modal */}
      {showQR && (
        <div 
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowQR(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Invite via QR</h3>
              <button 
                onClick={() => setShowQR(false)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid place-items-center rounded-xl bg-white p-4">
              <QRCodeSVG 
                value={`${window.location.origin}/room/${roomId}`}
                size={220}
                level="H"
              />
            </div>

            <p className="mb-3 text-center text-sm text-gray-400">
              Scan this QR code to join the room
            </p>

            <div className="mb-3 rounded-lg bg-gray-800 px-3 py-2">
              <p className="truncate text-xs text-gray-300">
                {`${window.location.origin}/room/${roomId}`}
              </p>
            </div>

            <button 
              onClick={copyLink}
              className="w-full rounded-xl bg-purple-500 py-2.5 font-semibold text-white hover:bg-purple-400"
            >
              {copied ? '✓ Link Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          15% { transform: translateY(-20px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-400px) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}