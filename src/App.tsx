import { useStore } from './store/useStore';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import GridCanvas2D from './components/GridCanvas2D';
import Viewport3D from './components/Viewport3D';
import HistoryTimeline from './components/HistoryTimeline';
import OnboardingOverlay from './components/OnboardingOverlay';
import { useEffect, useRef, useState, useCallback } from 'react';

export default function App() {
  const viewMode = useStore((s) => s.viewMode);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

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

  // Auto-close sidebar on narrow screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches && sidebarOpen) toggleSidebar();
    }
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full w-full" style={{ background: 'var(--bg-primary)' }}>
      <Toolbar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={toggleSidebar}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            flex flex-col w-80 shrink-0 h-full z-30
            fixed md:relative
            transition-transform duration-200 ease-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full'}
          `}
        >
          <Sidebar />
        </div>

        {/* Canvas area */}
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
              className="shrink-0 z-10 group hidden md:block"
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

          <HistoryTimeline />
        </div>
      </div>

      <OnboardingOverlay />
    </div>
  );
}
