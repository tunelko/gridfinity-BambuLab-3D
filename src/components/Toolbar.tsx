import { useState, useEffect, memo } from 'react';
import { useStore, type ViewMode, type RenderMode } from '../store/useStore';
import { GF } from '../gridfinity/constants';
import { initManifold } from '../hooks/useManifold';
import { generateBinExport, type BinConfig } from '../gridfinity/binGeometry';
import { manifoldToTriangleMesh, exportTo3MF, downloadBlob } from '../gridfinity/export3mf';

// ── Toast ──
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 rounded-lg font-medium shadow-lg animate-slide-up"
      style={{ background: 'var(--accent)', color: 'var(--bg-primary)', zIndex: 9999, padding: '10px 20px', fontSize: 13 }}
    >
      {message}
    </div>
  );
}

// ── Confirm modal ──
function ConfirmModal({
  title, message, confirmLabel, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}
      onClick={onCancel}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div
        className="shadow-2xl animate-slide-up"
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 32, minWidth: 400,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)', marginBottom: 16 }}>{title}</h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{message}</p>
        <div className="flex justify-end" style={{ gap: 12, paddingTop: 8 }}>
          <button
            onClick={onCancel}
            className="rounded-lg font-medium transition-colors hover:brightness-125"
            style={{ padding: '10px 20px', fontSize: 13, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            className="rounded-lg font-medium transition-colors hover:brightness-125"
            style={{ padding: '10px 20px', fontSize: 13, background: 'var(--danger)', color: '#fff' }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── About modal ──
function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="About Gridfinity Builder"
    >
      <div
        className="shadow-2xl animate-slide-up"
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 32, minWidth: 420, maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--accent)' }}>GRIDFINITY BUILDER</h3>
        <p className="mb-4" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>v0.2.0</p>

        <p className="leading-relaxed mb-3" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          Browser-based parametric CAD tool for designing, previewing, and exporting 3D-printable Gridfinity storage layouts.
        </p>

        <div className="leading-relaxed mb-4" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <p className="mb-2">
            Gridfinity is MIT licensed by{' '}
            <a href="https://www.youtube.com/@ZackFreedman" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>Zack Freedman</a>
          </p>
          <p className="mb-2">
            Spec:{' '}
            <a href="https://gridfinity.xyz/specification/" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>gridfinity.xyz</a>
          </p>
        </div>

        <div className="mb-4 rounded" style={{ fontSize: 11, padding: '8px 12px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          Built with Manifold 3D, Three.js, React, Zustand, Vite
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg font-medium transition-colors hover:brightness-125"
            style={{ padding: '10px 20px', fontSize: 13, background: 'var(--accent)', color: 'var(--bg-primary)' }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar button ──
const TBtn = memo(function TBtn({
  children, onClick, disabled, active, variant = 'default', ariaLabel,
}: {
  children: React.ReactNode; onClick: () => void;
  disabled?: boolean; active?: boolean;
  variant?: 'default' | 'accent' | 'danger'; ariaLabel?: string;
}) {
  const bg = active
    ? variant === 'danger' ? 'var(--danger)' : 'var(--accent)'
    : 'var(--bg-tertiary)';
  const color = active
    ? variant === 'danger' ? '#fff' : 'var(--bg-primary)'
    : variant === 'danger' ? 'var(--danger)'
    : variant === 'accent' ? 'var(--accent)'
    : 'var(--text-secondary)';

  return (
    <button
      onClick={onClick} disabled={disabled}
      className="rounded-md font-medium transition-all hover:brightness-125 disabled:opacity-40 disabled:pointer-events-none"
      style={{ padding: '8px 14px', fontSize: 13, background: bg, color, border: active ? 'none' : '1px solid var(--border)' }}
      aria-label={ariaLabel} aria-pressed={active}
    >
      {children}
    </button>
  );
});

// ── Segmented button group ──
function SegGroup<T extends string>({ items, value, onChange, ariaLabel }: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex items-center rounded-lg"
      style={{ padding: 2, gap: 2, background: 'var(--bg-primary)' }}
      role="radiogroup" aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className="rounded-md font-medium transition-all"
          style={{
            padding: '8px 14px', fontSize: 13,
            background: value === item.value ? 'var(--accent)' : 'transparent',
            color: value === item.value ? 'var(--bg-primary)' : 'var(--text-secondary)',
          }}
          role="radio" aria-checked={value === item.value}
        >{item.label}</button>
      ))}
    </div>
  );
}

// ── Main Toolbar ──
export default function Toolbar() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const renderMode = useStore((s) => s.renderMode);
  const setRenderMode = useStore((s) => s.setRenderMode);
  const showDimensions = useStore((s) => s.showDimensions);
  const setShowDimensions = useStore((s) => s.setShowDimensions);
  const sectionView = useStore((s) => s.sectionView);
  const setSectionView = useStore((s) => s.setSectionView);
  const bins = useStore((s) => s.bins);
  const selectedBinId = useStore((s) => s.selectedBinId);
  const clearAll = useStore((s) => s.clearAll);
  const gridCols = useStore((s) => s.gridCols);
  const gridRows = useStore((s) => s.gridRows);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function emitCameraPreset(preset: string) {
    window.dispatchEvent(new CustomEvent('camera-preset', { detail: preset }));
  }

  async function handleExport(mode: 'selected' | 'all') {
    const binsToExport = mode === 'selected'
      ? bins.filter((b) => b.id === selectedBinId)
      : bins;
    if (binsToExport.length === 0) return;

    setExporting(true);
    setExportProgress('Initializing Manifold...');
    try {
      const wasm = await initManifold();
      const meshes: { mesh: { vertices: Float32Array; triangles: Uint32Array }; name: string }[] = [];

      for (let i = 0; i < binsToExport.length; i++) {
        const bin = binsToExport[i];
        setExportProgress(`Generating ${i + 1}/${binsToExport.length}...`);

        const config: BinConfig = {
          w: bin.w, d: bin.d, h: bin.h,
          cornerRadius: bin.cornerRadius, wallThickness: bin.wallThickness,
          bottomThickness: bin.bottomThickness,
          magnets: bin.magnets, screws: bin.screws,
          labelShelf: bin.labelShelf, labelWidth: bin.labelWidth,
          dividersX: bin.dividersX, dividersY: bin.dividersY,
        };

        const manifold = generateBinExport(wasm, config);
        const mesh = manifoldToTriangleMesh(manifold);
        manifold.delete();

        if (mode === 'all') {
          const ox = (bin.x + bin.w / 2) * GF.CELL_SIZE - (gridCols * GF.CELL_SIZE) / 2;
          const oy = (bin.y + bin.d / 2) * GF.CELL_SIZE - (gridRows * GF.CELL_SIZE) / 2;
          for (let j = 0; j < mesh.vertices.length; j += 3) {
            mesh.vertices[j] += ox;
            mesh.vertices[j + 1] += oy;
          }
        }

        const name = bin.label || `Bin_${bin.w}x${bin.d}x${bin.h}u`;
        meshes.push({ mesh, name });
      }

      setExportProgress('Packaging .3mf...');
      const blob = await exportTo3MF(meshes);
      const filename = mode === 'selected'
        ? `${meshes[0].name}.3mf`
        : `gridfinity_layout_${gridCols}x${gridRows}.3mf`;
      downloadBlob(blob, filename);
      setToast(`Exported ${meshes.length} ${meshes.length === 1 ? 'bin' : 'bins'} as .3mf`);
    } catch (err) {
      console.error('Export failed:', err);
      setToast('Export failed — ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
      setExportProgress('');
    }
  }

  function handleClearConfirm() {
    const count = bins.length;
    clearAll();
    setShowClearModal(false);
    setToast(`Cleared ${count} ${count === 1 ? 'bin' : 'bins'}`);
  }

  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  return (
    <>
      <div
        className="flex items-center shrink-0"
        style={{ padding: '0 16px', height: 48, gap: 12, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
        role="toolbar" aria-label="Main toolbar"
        data-onboarding="toolbar"
      >
        {/* Hamburger (sidebar toggle) */}
        <button
          onClick={toggleSidebar}
          className="shrink-0 hover:brightness-125 transition-all"
          style={{ fontSize: 18, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        {/* Logo */}
        <button
          onClick={() => setShowAbout(true)}
          className="font-bold tracking-wide shrink-0 hover:brightness-125 transition-all hidden sm:block"
          style={{ fontSize: 14, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label="About Gridfinity Builder"
        >
          GRIDFINITY
        </button>

        <div className="shrink-0 hidden sm:block" style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* View mode */}
        <SegGroup
          items={[
            { value: '2d' as ViewMode, label: '2D' },
            { value: 'split' as ViewMode, label: 'Split' },
            { value: '3d' as ViewMode, label: '3D' },
          ]}
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="View mode"
        />

        <div className="flex-1" />

        {/* Render mode (hide on small screens) */}
        <div className="hidden lg:block">
          <SegGroup
            items={[
              { value: 'standard' as RenderMode, label: 'Solid' },
              { value: 'technical' as RenderMode, label: 'X-Ray' },
              { value: 'blueprint' as RenderMode, label: 'Blueprint' },
            ]}
            value={renderMode}
            onChange={setRenderMode}
            ariaLabel="Render mode"
          />
        </div>

        {/* Camera presets (hide on small screens) */}
        <div className="hidden xl:flex items-center" style={{ gap: 4 }} role="group" aria-label="Camera presets">
          {['Iso', 'Front', 'Top'].map((preset) => (
            <button
              key={preset} onClick={() => emitCameraPreset(preset.toLowerCase())}
              className="rounded-md font-medium transition-all hover:brightness-125"
              style={{
                padding: '8px 14px', fontSize: 13,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              }}
              aria-label={`${preset} camera view`}
            >{preset}</button>
          ))}
        </div>

        <div className="shrink-0 hidden lg:block" style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Actions */}
        <div className="flex items-center" style={{ gap: 6 }} role="group" aria-label="Actions" data-onboarding="export">
          <TBtn onClick={() => setShowDimensions(!showDimensions)} active={showDimensions} ariaLabel="Toggle dimension labels">
            📏
          </TBtn>
          <TBtn onClick={() => setSectionView(!sectionView)} active={sectionView} variant="danger" ariaLabel="Toggle section view">
            🔪
          </TBtn>

          {selectedBinId && (
            <TBtn onClick={() => handleExport('selected')} disabled={exporting} variant="accent" ariaLabel="Export selected bin">
              {exporting ? exportProgress || 'Exporting...' : 'Export Bin'}
            </TBtn>
          )}

          <TBtn onClick={() => handleExport('all')} disabled={exporting || bins.length === 0} variant="accent" ariaLabel="Export all bins">
            {exporting ? exportProgress || 'Exporting...' : 'Export All'}
          </TBtn>

          <TBtn onClick={() => setShowClearModal(true)} disabled={bins.length === 0} variant="danger" ariaLabel="Clear all bins">
            🗑️
          </TBtn>
        </div>

        {/* Export progress bar */}
        {exporting && (
          <div className="rounded-full overflow-hidden" style={{ width: 96, height: 4, background: 'var(--bg-tertiary)' }}>
            <div className="progress-bar" />
          </div>
        )}
      </div>

      {showClearModal && (
        <ConfirmModal
          title="Clear All Bins"
          message={`This will remove all ${bins.length} bin${bins.length === 1 ? '' : 's'} from the grid. You can undo this with Ctrl+Z.`}
          confirmLabel="Clear All"
          onConfirm={handleClearConfirm}
          onCancel={() => setShowClearModal(false)}
        />
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
