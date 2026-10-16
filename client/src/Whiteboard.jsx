import { useEffect, useRef, useState } from 'react';
import { Pen, Eraser, Trash2, X } from 'lucide-react';

const BG = '#111827'; // gray-900
const COLORS = ['#ffffff', '#a855f7', '#ef4444', '#22c55e', '#3b82f6', '#eab308'];

export default function Whiteboard({ socket, visible, onClose }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const segs = useRef([]); // normalized segments so every screen size stays in sync
  const drawing = useRef(false);
  const last = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[1]);

  const drawSeg = (ctx, w, h, s) => {
    ctx.beginPath();
    ctx.moveTo(s.x0 * w, s.y0 * h);
    ctx.lineTo(s.x1 * w, s.y1 * h);
    ctx.strokeStyle = s.erase ? BG : s.color;
    ctx.lineWidth = s.erase ? 24 : 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const redraw = () => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, c.width, c.height);
    segs.current.forEach((s) => drawSeg(ctx, c.width, c.height, s));
  };

  // keep canvas pixel size equal to its container (also fires when it becomes visible)
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    const ro = new ResizeObserver(() => {
      if (!wrap.clientWidth) return;
      c.width = wrap.clientWidth;
      c.height = wrap.clientHeight;
      redraw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // socket sync (stays mounted while hidden so no strokes are missed)
  useEffect(() => {
    const onDraw = (s) => {
      segs.current.push(s);
      const c = canvasRef.current;
      if (c?.width) drawSeg(c.getContext('2d'), c.width, c.height, s);
    };
    const onClear = () => { segs.current = []; redraw(); };
    const onHistory = (board) => { segs.current = board; redraw(); };
    socket.on('whiteboard-draw', onDraw);
    socket.on('whiteboard-clear', onClear);
    socket.on('whiteboard-history', onHistory);
    socket.emit('whiteboard-request');
    return () => {
      socket.off('whiteboard-draw', onDraw);
      socket.off('whiteboard-clear', onClear);
      socket.off('whiteboard-history', onHistory);
    };
  }, [socket]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const down = (e) => {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = pos(e);
    const seg = { x0: last.current.x, y0: last.current.y, x1: p.x, y1: p.y, color, erase: tool === 'eraser' };
    last.current = p;
    segs.current.push(seg);
    const c = canvasRef.current;
    drawSeg(c.getContext('2d'), c.width, c.height, seg);
    socket.emit('whiteboard-draw', seg);
  };
  const up = () => { drawing.current = false; };
  const clear = () => { segs.current = []; redraw(); socket.emit('whiteboard-clear'); };

  const toolBtn = (active) =>
    `grid h-9 w-9 place-items-center rounded-lg transition ${active ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;

  return (
    <div className={`${visible ? 'flex' : 'hidden'} absolute inset-3 bottom-24 z-10 flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 p-2">
        <button onClick={() => setTool('pen')} className={toolBtn(tool === 'pen')} title="Pen"><Pen className="h-4 w-4" /></button>
        <button onClick={() => setTool('eraser')} className={toolBtn(tool === 'eraser')} title="Eraser"><Eraser className="h-4 w-4" /></button>
        <div className="mx-1 flex gap-1.5">
          {COLORS.map((c) => (
            <button key={c} onClick={() => { setColor(c); setTool('pen'); }} aria-label={`Color ${c}`}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full border-2 ${color === c && tool === 'pen' ? 'border-white' : 'border-transparent'}`} />
          ))}
        </div>
        <button onClick={clear} className="ml-auto flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-sm text-red-400 hover:bg-gray-700"><Trash2 className="h-4 w-4" /> Clear</button>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-800" aria-label="Close whiteboard"><X className="h-5 w-5" /></button>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      </div>
    </div>
  );
}
