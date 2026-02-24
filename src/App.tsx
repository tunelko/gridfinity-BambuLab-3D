import { useStore } from './store/useStore';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import GridCanvas2D from './components/GridCanvas2D';
import Viewport3D from './components/Viewport3D';
import { useEffect, useRef, useState, useCallback } from 'react';

export default function App() {
  const viewMode = useStore((s) => s.viewMode);

  const [splitPercent, setSplitPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.min(80, Math.max(20, (x / rect.width) * 100));
      setSplitPercent(pct);
    };

    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full" style={{ background: 'var(--bg-primary)' }}>
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
          {(viewMode === '2d' || viewMode === 'split') && (
            <div
              style={{
                width: viewMode === 'split' ? `${splitPercent}%` : '100%',
                flexShrink: 0,
              }}
            >
              <GridCanvas2D />
            </div>
          )}
          {viewMode === 'split' && (
            <div
              onMouseDown={handleMouseDown}
              className="shrink-0 z-10 group"
              style={{
                width: '6px',
                cursor: 'col-resize',
                background: 'var(--border)',
                transition: draggingRef.current ? 'none' : 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
              onMouseLeave={(e) => { if (!draggingRef.current) (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
            />
          )}
          {(viewMode === '3d' || viewMode === 'split') && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <Viewport3D />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
