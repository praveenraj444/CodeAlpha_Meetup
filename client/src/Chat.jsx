import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Download, X, Loader2, FileText, Ban } from 'lucide-react';
import { SERVER_URL } from './config.js';

const MAX_BASE64 = 5 * 1024 * 1024;
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });

export default function Chat({ socket, open, onClose, blocked = false }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const onMsg = (m) => setMessages((p) => [...p, m]);
    const onFile = (m) => setMessages((p) => [...p, m]);
    const onJoin = ({ name }) => setMessages((p) => [...p, { id: `j${Date.now()}${name}`, system: `${name} joined` }]);
    const onLeft = ({ name }) => setMessages((p) => [...p, { id: `l${Date.now()}${name}`, system: `${name} left` }]);
    socket.on('chat-message', onMsg);
    socket.on('file-share', onFile);
    socket.on('user-joined', onJoin);
    socket.on('user-left', onLeft);
    return () => {
      socket.off('chat-message', onMsg);
      socket.off('file-share', onFile);
      socket.off('user-joined', onJoin);
      socket.off('user-left', onLeft);
    };
  }, [socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  const send = (e) => {
    e.preventDefault();
    if (blocked) return;
    const t = text.trim();
    if (!t) return;
    socket.emit('chat-message', { text: t });
    setText('');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || blocked) return;
    setError('');
    setUploading(true);
    try {
      let payload = null;

      // 1) Try server upload (multer)
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${SERVER_URL}/upload`, { method: 'POST', body: fd });
        if (res.ok) {
          payload = await res.json();
          console.log('✅ Uploaded via server:', payload);
        } else {
          console.warn('⚠️ Server upload failed:', res.status);
        }
      } catch (err) {
        console.warn('⚠️ Server upload error:', err.message);
      }

      // 2) Fallback: base64 (for small files)
      if (!payload) {
        if (file.size > MAX_BASE64) {
          throw new Error('Upload failed. Files over 5 MB need server /upload endpoint working.');
        }
        const dataUrl = await readAsDataURL(file);
        payload = { url: dataUrl, name: file.name, size: file.size, type: file.type };
        console.log('✅ Using base64 fallback:', file.name);
      }

      // 3) Emit to room
      socket.emit('file-share', payload);
    } catch (err) {
      console.error('File send error:', err);
      setError(err.message || 'File send failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className={`${open ? 'flex' : 'hidden'} fixed inset-0 z-[70] flex-col bg-gray-900 md:static md:z-40 md:w-80 md:shrink-0 md:border-l md:border-gray-800`}>
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <h2 className="font-semibold">Chat</h2>
        <div className="flex items-center gap-2">
          {blocked && <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300"><Ban className="h-3 w-3" /> Blocked</span>}
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white" aria-label="Close chat"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="mt-10 text-center text-sm text-gray-500">No messages yet. Say hi 👋</p>}
        {messages.map((m) => {
          if (m.system) return <p key={m.id} className="text-center text-xs text-gray-500">{m.system}</p>;
          const mine = m.senderId === socket.id;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 text-xs text-gray-500">{mine ? 'You' : m.name} · {fmtTime(m.time)}</span>
              <div className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-sm bg-purple-600' : 'rounded-bl-sm bg-gray-800'}`}>
                {m.file ? (
                  <div className="space-y-2">
                    {m.file.type?.startsWith('image/') && <img src={m.file.url} alt={m.file.name} className="max-h-40 rounded-lg" />}
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.file.name}</p>
                        <p className="text-xs opacity-70">{fmtSize(m.file.size)}</p>
                      </div>
                      <a href={m.file.url} download={m.file.name} target="_blank" rel="noreferrer"
                        className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 hover:bg-white/30" aria-label="Download">
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ) : m.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {blocked && <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-300"><Ban className="h-4 w-4" /> Chat is blocked by host</div>}
      {error && <p className="mx-4 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-gray-800 bg-gray-900 p-3 pb-[88px] md:pb-3 relative z-10">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || blocked}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-20" aria-label="Attach file">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)}
          placeholder={blocked ? "Chat blocked by host..." : "Type a message…"}
          disabled={blocked}
          className="min-w-0 flex-1 rounded-full border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm outline-none focus:border-purple-500 disabled:opacity-30" />
        <button disabled={blocked} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-purple-500 hover:bg-purple-400 disabled:opacity-20" aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </aside>
  );
}