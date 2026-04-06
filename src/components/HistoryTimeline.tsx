import { useStore } from '../store/useStore';

export default function HistoryTimeline() {
  const history = useStore((s) => s.history);
  const historyIndex = useStore((s) => s.historyIndex);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const jumpToHistory = useStore((s) => s.jumpToHistory);

  if (history.length <= 1) return null;

  const useSlider = history.length > 30;

  return (
    <div
      style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(10, 10, 15, 0.85)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '4px 12px', zIndex: 20,
        backdropFilter: 'blur(8px)',
        fontSize: 11, pointerEvents: 'auto',
      }}
    >
      <button
        disabled={historyIndex <= 0}
        onClick={undo}
        className="transition-colors hover:brightness-125 disabled:opacity-30"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 14, padding: '2px 4px',
        }}
        aria-label="Undo"
      >
        ←
      </button>

      {useSlider ? (
        <input
          type="range"
          min={0}
          max={history.length - 1}
          value={historyIndex}
          onChange={(e) => jumpToHistory(Number(e.target.value))}
          className="custom-slider"
          style={{ width: 200, height: 6 }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, maxWidth: 300 }}>
          {history.map((entry, i) => (
            <button
              key={i}
              onClick={() => jumpToHistory(i)}
              title={`Step ${i}: ${entry.length} bins`}
              style={{
                width: i === historyIndex ? 10 : 6,
                height: i === historyIndex ? 10 : 6,
                borderRadius: '50%',
                background: i <= historyIndex ? 'var(--accent)' : 'var(--border)',
                opacity: i === historyIndex ? 1 : 0.5,
                border: 'none', cursor: 'pointer',
                transition: 'all 0.15s',
                padding: 0, flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}

      <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
        {historyIndex}/{history.length - 1}
      </span>

      <button
        disabled={historyIndex >= history.length - 1}
        onClick={redo}
        className="transition-colors hover:brightness-125 disabled:opacity-30"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 14, padding: '2px 4px',
        }}
        aria-label="Redo"
      >
        →
      </button>
    </div>
  );
}
