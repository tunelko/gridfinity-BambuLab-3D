import { useState } from 'react';
import { useStore, type Bin } from '../store/useStore';
import { GF, GRID_PRESETS, BIN_PRESETS } from '../gridfinity/constants';
import { checkCollision } from '../utils/collision';
import BinConfigurator from './BinConfigurator';

// ── PWA force update ──

async function forceUpdate() {
  // 1. Clear all caches
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
  // 2. Unregister all service workers
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  // 3. Hard reload (bypass cache)
  window.location.reload();
}

// ── Save/Load helpers ──

interface SavedLayout {
  name: string;
  gridCols: number;
  gridRows: number;
  bins: Omit<Bin, 'id'>[];
  date: string;
}

const STORAGE_KEY = 'gridfinity-layouts';

function getSavedLayouts(): SavedLayout[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveLayout(layout: SavedLayout) {
  const layouts = getSavedLayouts();
  // Replace if same name exists
  const idx = layouts.findIndex((l) => l.name === layout.name);
  if (idx >= 0) layouts[idx] = layout;
  else layouts.push(layout);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

function deleteLayout(name: string) {
  const layouts = getSavedLayouts().filter((l) => l.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

// ── URL sharing ──

function encodeLayoutToURL(): string {
  const { bins, gridCols, gridRows } = useStore.getState();
  const data = {
    c: gridCols,
    r: gridRows,
    b: bins.map((b) => ({
      x: b.x, y: b.y, w: b.w, d: b.d, h: b.h,
      cr: b.cornerRadius, wt: b.wallThickness, bt: b.bottomThickness,
      sl: b.stackingLip ? 1 : 0, ls: b.labelShelf ? 1 : 0, lw: b.labelWidth,
      mg: b.magnets ? 1 : 0, sc: b.screws ? 1 : 0,
      dx: b.dividersX, dy: b.dividersY,
      lb: b.label,
    })),
  };
  const json = JSON.stringify(data);
  const encoded = btoa(encodeURIComponent(json));
  return `${window.location.origin}${window.location.pathname}#layout=${encoded}`;
}

function decodeLayoutFromURL(): { gridCols: number; gridRows: number; bins: Omit<Bin, 'id'>[] } | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#layout=')) return null;
  try {
    const encoded = hash.slice('#layout='.length);
    const json = decodeURIComponent(atob(encoded));
    const data = JSON.parse(json);
    return {
      gridCols: data.c,
      gridRows: data.r,
      bins: data.b.map((b: any) => ({
        x: b.x, y: b.y, w: b.w, d: b.d, h: b.h,
        cornerRadius: b.cr, wallThickness: b.wt, bottomThickness: b.bt,
        stackingLip: !!b.sl, labelShelf: !!b.ls, labelWidth: b.lw,
        magnets: !!b.mg, screws: !!b.sc,
        dividersX: b.dx, dividersY: b.dy,
        color: '', label: b.lb || '',
      })),
    };
  } catch { return null; }
}

// Load from URL on first import
(function loadFromURL() {
  const layout = decodeLayoutFromURL();
  if (!layout) return;
  const store = useStore.getState();
  store.setGridSize(layout.gridCols, layout.gridRows);
  for (const bin of layout.bins) {
    store.addBin(bin);
  }
  // Clear hash so it doesn't reload on refresh
  history.replaceState(null, '', window.location.pathname);
})();

// ── Component ──

export default function Sidebar() {
  const bins = useStore((s) => s.bins);
  const selectedBinId = useStore((s) => s.selectedBinId);
  const selectBin = useStore((s) => s.selectBin);
  const addBin = useStore((s) => s.addBin);
  const removeBin = useStore((s) => s.removeBin);
  const gridCols = useStore((s) => s.gridCols);
  const gridRows = useStore((s) => s.gridRows);
  const setGridSize = useStore((s) => s.setGridSize);
  const startPlacing = useStore((s) => s.startPlacing);
  const dragState = useStore((s) => s.dragState);
  const clearAll = useStore((s) => s.clearAll);

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savedLayouts, setSavedLayouts] = useState(getSavedLayouts);

  const [autoFillSize, setAutoFillSize] = useState<{ w: number; d: number; h: number }>({ w: 1, d: 1, h: 3 });
  const [plaEurKg, setPlaEurKg] = useState(20); // €/kg default
  const selectedBin = bins.find((b) => b.id === selectedBinId) ?? null;

  // ── BOM: group bins by type ──
  const bom = (() => {
    const groups: Record<string, { w: number; d: number; h: number; label: string; count: number; volumeCm3: number }> = {};
    for (const b of bins) {
      const key = `${b.w}x${b.d}x${b.h}`;
      if (!groups[key]) {
        const outerW = b.w * GF.CELL_SIZE - GF.TOLERANCE;
        const outerD = b.d * GF.CELL_SIZE - GF.TOLERANCE;
        const totalH = b.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT;
        const innerW = outerW - 2 * GF.WALL_THICKNESS;
        const innerD = outerD - 2 * GF.WALL_THICKNESS;
        const innerH = totalH - GF.BOTTOM_THICKNESS - GF.BASE_TOTAL_HEIGHT;
        const outerVol = outerW * outerD * totalH;
        const innerVol = innerW > 0 && innerD > 0 && innerH > 0 ? innerW * innerD * innerH : 0;
        const volMm3 = outerVol - innerVol;
        groups[key] = { w: b.w, d: b.d, h: b.h, label: b.label || key, count: 0, volumeCm3: volMm3 / 1000 };
      }
      groups[key].count++;
    }
    return Object.values(groups);
  })();

  const totalVolume = bom.reduce((sum, g) => sum + g.volumeCm3 * g.count, 0);
  const totalWeightPLA = totalVolume * 1.24; // PLA density ~1.24 g/cm³

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function handleAddBin(preset?: typeof BIN_PRESETS[number]) {
    const config: Omit<Bin, 'id' | 'x' | 'y'> = {
      w: preset?.w ?? 1,
      d: preset?.d ?? 1,
      h: preset?.h ?? 3,
      cornerRadius: GF.BIN_CORNER_RADIUS,
      wallThickness: GF.WALL_THICKNESS,
      bottomThickness: GF.BOTTOM_THICKNESS,
      stackingLip: false,
      labelShelf: preset?.labelShelf ?? false,
      labelWidth: GF.LABEL_DEFAULT_WIDTH,
      magnets: preset?.magnets ?? false,
      screws: preset?.screws ?? false,
      dividersX: preset?.dividersX ?? 0,
      dividersY: preset?.dividersY ?? 0,
      color: '',
      label: preset?.name ?? '',
    };
    startPlacing(config);
  }

  function handleQuickAdd(preset?: typeof BIN_PRESETS[number]) {
    const w = preset?.w ?? 1;
    const d = preset?.d ?? 1;
    for (let row = 0; row <= gridRows - d; row++) {
      for (let col = 0; col <= gridCols - w; col++) {
        if (!checkCollision(bins, { x: col, y: row, w, d }, null, gridCols, gridRows)) {
          addBin({
            x: col, y: row, w, d,
            h: preset?.h ?? 3,
            cornerRadius: GF.BIN_CORNER_RADIUS,
            wallThickness: GF.WALL_THICKNESS,
            bottomThickness: GF.BOTTOM_THICKNESS,
            stackingLip: false,
            labelShelf: preset?.labelShelf ?? false,
            labelWidth: GF.LABEL_DEFAULT_WIDTH,
            magnets: preset?.magnets ?? false,
            screws: preset?.screws ?? false,
            dividersX: preset?.dividersX ?? 0,
            dividersY: preset?.dividersY ?? 0,
            color: '',
            label: preset?.name ?? '',
          });
          return;
        }
      }
    }
  }

  function handleSaveLayout() {
    if (!saveName.trim()) return;
    const layout: SavedLayout = {
      name: saveName.trim(),
      gridCols,
      gridRows,
      bins: bins.map(({ id, ...rest }) => rest),
      date: new Date().toISOString().split('T')[0],
    };
    saveLayout(layout);
    setSavedLayouts(getSavedLayouts());
    setShowSaveInput(false);
    setSaveName('');
    showToast(`Saved "${layout.name}"`);
  }

  function handleLoadLayout(layout: SavedLayout) {
    clearAll();
    setGridSize(layout.gridCols, layout.gridRows);
    for (const bin of layout.bins) {
      addBin(bin);
    }
    setShowLoadDropdown(false);
    showToast(`Loaded "${layout.name}"`);
  }

  function handleDeleteLayout(name: string) {
    deleteLayout(name);
    setSavedLayouts(getSavedLayouts());
  }

  function handleAutoFill() {
    const { w, d, h } = autoFillSize;
    let placed = 0;
    for (let row = 0; row <= gridRows - d; row++) {
      for (let col = 0; col <= gridCols - w; col++) {
        const currentBins = useStore.getState().bins;
        if (!checkCollision(currentBins, { x: col, y: row, w, d }, null, gridCols, gridRows)) {
          addBin({
            x: col, y: row, w, d, h,
            cornerRadius: GF.BIN_CORNER_RADIUS,
            wallThickness: GF.WALL_THICKNESS,
            bottomThickness: GF.BOTTOM_THICKNESS,
            stackingLip: false, labelShelf: false, labelWidth: GF.LABEL_DEFAULT_WIDTH,
            magnets: false, screws: false,
            dividersX: 0, dividersY: 0,
            color: '', label: '',
          });
          placed++;
        }
      }
    }
    if (placed > 0) showToast(`Filled ${placed} bins`);
    else showToast('No empty space');
  }

  function handleAutoLayout() {
    if (bins.length === 0) return;
    // Find minimum bounding box that fits all bins using greedy packing
    const sorted = [...bins].sort((a, b) => (b.w * b.d) - (a.w * a.d)); // largest first
    let bestCols = gridCols, bestRows = gridRows;

    // Try shrinking from current size
    for (let cols = Math.max(...sorted.map(b => b.w)); cols <= gridCols; cols++) {
      for (let rows = Math.max(...sorted.map(b => b.d)); rows <= gridRows; rows++) {
        if (cols * rows >= bestCols * bestRows) continue; // not better
        // Try to pack all bins in cols×rows
        const occupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
        let allFit = true;

        for (const bin of sorted) {
          let placed = false;
          for (let r = 0; r <= rows - bin.d && !placed; r++) {
            for (let c = 0; c <= cols - bin.w && !placed; c++) {
              // Check if space is free
              let free = true;
              for (let dr = 0; dr < bin.d && free; dr++) {
                for (let dc = 0; dc < bin.w && free; dc++) {
                  if (occupied[r + dr][c + dc]) free = false;
                }
              }
              if (free) {
                for (let dr = 0; dr < bin.d; dr++)
                  for (let dc = 0; dc < bin.w; dc++)
                    occupied[r + dr][c + dc] = true;
                placed = true;
              }
            }
          }
          if (!placed) { allFit = false; break; }
        }

        if (allFit) {
          bestCols = cols;
          bestRows = rows;
        }
      }
    }

    if (bestCols === gridCols && bestRows === gridRows) {
      showToast('Already optimal');
      return;
    }

    // Re-pack with best size
    const occupied: boolean[][] = Array.from({ length: bestRows }, () => Array(bestCols).fill(false));
    clearAll();
    setGridSize(bestCols, bestRows);

    for (const bin of sorted) {
      for (let r = 0; r <= bestRows - bin.d; r++) {
        let placed = false;
        for (let c = 0; c <= bestCols - bin.w; c++) {
          let free = true;
          for (let dr = 0; dr < bin.d && free; dr++)
            for (let dc = 0; dc < bin.w && free; dc++)
              if (occupied[r + dr][c + dc]) free = false;
          if (free) {
            for (let dr = 0; dr < bin.d; dr++)
              for (let dc = 0; dc < bin.w; dc++)
                occupied[r + dr][c + dc] = true;
            const { id, x, y, ...rest } = bin;
            addBin({ ...rest, x: c, y: r });
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }

    showToast(`Optimized to ${bestCols}x${bestRows}`);
  }

  function handlePrintLabels() {
    if (bins.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) { showToast('Popup blocked'); return; }

    const labels = bins.map((b) => {
      const wMM = b.w * GF.CELL_SIZE - GF.TOLERANCE;
      const dMM = b.d * GF.CELL_SIZE - GF.TOLERANCE;
      const hMM = b.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT;
      return `
        <div style="border:1px solid #333;border-radius:6px;padding:10px 14px;display:inline-block;margin:4px;min-width:140px;font-family:monospace;font-size:12px;page-break-inside:avoid;">
          <div style="font-size:14px;font-weight:bold;margin-bottom:4px;">${b.label || 'Bin'}</div>
          <div style="color:#666;">${b.w}x${b.d}x${b.h}u</div>
          <div style="color:#888;font-size:11px;">${wMM.toFixed(1)} x ${dMM.toFixed(1)} x ${hMM.toFixed(1)} mm</div>
          <div style="color:#aaa;font-size:10px;margin-top:2px;">Grid: (${b.x},${b.y})</div>
          ${b.dividersX > 0 || b.dividersY > 0 ? `<div style="color:#aaa;font-size:10px;">Div: ${b.dividersX}x${b.dividersY}</div>` : ''}
          ${b.stackingLip ? '<div style="color:#aaa;font-size:10px;">Stacking lip</div>' : ''}
          ${b.magnets ? '<div style="color:#aaa;font-size:10px;">Magnets</div>' : ''}
        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Gridfinity Labels</title>
      <style>@media print{body{margin:0}}</style></head>
      <body style="padding:16px;font-family:system-ui;">
        <h2 style="font-family:monospace;font-size:16px;margin-bottom:12px;">
          Gridfinity Layout — ${gridCols}x${gridRows} grid, ${bins.length} bins
        </h2>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${labels}</div>
        <script>window.print();</script>
      </body></html>`);
    win.document.close();
  }

  function handleCopyLink() {
    const url = encodeLayoutToURL();
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(
          () => showToast('Link copied!'),
          () => fallbackCopy(url),
        );
      } else {
        fallbackCopy(url);
      }
    } catch {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Link copied!');
    } catch {
      showToast('Failed to copy');
    }
    document.body.removeChild(ta);
  }

  const plateMM = `${gridCols * GF.CELL_SIZE} x ${gridRows * GF.CELL_SIZE} mm`;

  return (
    <nav
      className="flex flex-col w-80 shrink-0 overflow-y-auto relative"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      aria-label="Sidebar controls"
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed rounded-lg font-medium shadow-lg animate-slide-up"
          style={{
            top: 16, right: 24,
            background: 'rgba(59, 130, 246, 0.85)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            zIndex: 9999, padding: '10px 20px', fontSize: 13,
          }}
        >
          {toast}
        </div>
      )}

      {/* Printer / Baseplate */}
      <Section title="PRINTER / BASEPLATE">
        <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {GRID_PRESETS.map((p) => {
            const active = gridCols === p.cols && gridRows === p.rows;
            return (
              <button
                key={p.name}
                onClick={() => setGridSize(p.cols, p.rows)}
                className="transition-colors hover:brightness-125"
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Grid:</label>
          <input
            type="number" min={1} max={20} value={gridCols}
            onChange={(e) => setGridSize(Number(e.target.value), gridRows)}
            className="rounded text-center"
            style={{
              width: 52, height: 32, padding: '4px 8px', fontSize: 14,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>x</span>
          <input
            type="number" min={1} max={20} value={gridRows}
            onChange={(e) => setGridSize(gridCols, Number(e.target.value))}
            className="rounded text-center"
            style={{
              width: 52, height: 32, padding: '4px 8px', fontSize: 14,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span className="ml-auto" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{plateMM}</span>
        </div>
      </Section>

      {/* Add Bin */}
      <Section title="ADD BIN">
        {dragState.mode === 'placing' ? (
          <div className="text-center" style={{ padding: '12px 0', color: 'var(--accent)' }}>
            <div style={{ marginBottom: 10, fontSize: 13 }}>Click on grid to place bin...</div>
            <button
              onClick={() => useStore.getState().cancelPlacing()}
              className="rounded transition-colors hover:brightness-125"
              style={{
                padding: '8px 20px', fontSize: 13,
                background: 'var(--bg-tertiary)', color: 'var(--danger)', border: '1px solid var(--border)',
              }}
            >
              Cancel (Esc)
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleAddBin()}
              className="w-full rounded font-semibold transition-colors hover:brightness-125"
              style={{
                height: 40, fontSize: 14, marginBottom: 12,
                background: 'var(--accent)', color: 'var(--bg-primary)',
              }}
            >
              + Place 1x1 Bin
            </button>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {BIN_PRESETS.map((p) => (
                <div key={p.name} className="flex" style={{ gap: 6 }}>
                  <button
                    onClick={() => handleAddBin(p)}
                    className="flex-1 rounded text-left transition-colors hover:brightness-125"
                    style={{
                      minHeight: 40, padding: '8px 12px', fontSize: 13,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                    }}
                  >
                    {p.name}
                    <span style={{ opacity: 0.4, marginLeft: 8, fontSize: 11 }}>
                      {p.w}x{p.d}x{p.h}u
                    </span>
                  </button>
                  <button
                    onClick={() => handleQuickAdd(p)}
                    className="rounded transition-colors hover:brightness-125 flex items-center justify-center shrink-0"
                    style={{
                      width: 40, minHeight: 40, fontSize: 18, fontWeight: 600,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--accent)',
                    }}
                    title="Quick add (auto-place)"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Bin List */}
      <Section title={`BINS (${bins.length})`}>
        {bins.length === 0 ? (
          <p className="text-center" style={{ padding: '12px 0', opacity: 0.4, fontSize: 13 }}>No bins placed yet</p>
        ) : (
          <div className="flex flex-col" style={{ gap: 4 }}>
            {bins.map((bin) => {
              const isSelected = selectedBinId === bin.id;
              return (
                <div
                  key={bin.id}
                  onClick={() => selectBin(bin.id)}
                  className="flex items-center rounded cursor-pointer transition-colors"
                  style={{
                    gap: 10, padding: '6px 12px', minHeight: 36,
                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'rgba(255,255,255,0.03)'); }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent'); }}
                >
                  <div className="shrink-0" style={{ width: 14, height: 14, borderRadius: 3, background: bin.color }} />
                  <div className="flex-1 truncate" style={{ fontSize: 13 }}>
                    {bin.label || 'Bin'}
                    <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 6 }}>
                      {bin.w}x{bin.d}x{bin.h}u
                    </span>
                  </div>
                  <span style={{ fontSize: 11, opacity: 0.4 }}>
                    ({bin.x},{bin.y})
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBin(bin.id); }}
                    className="opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center"
                    style={{ color: 'var(--danger)', width: 20, height: 20, fontSize: 14 }}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Configurator */}
      {selectedBin && <BinConfigurator bin={selectedBin} />}

      {/* Save / Load / Share */}
      <Section title="LAYOUT">
        <div className="flex flex-col" style={{ gap: 8 }}>
          {/* Save */}
          {showSaveInput ? (
            <div className="flex" style={{ gap: 6 }}>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLayout(); if (e.key === 'Escape') setShowSaveInput(false); }}
                placeholder="Layout name..."
                autoFocus
                className="flex-1 rounded"
                style={{
                  padding: '8px 12px', fontSize: 13, height: 38,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={handleSaveLayout}
                className="rounded font-medium hover:brightness-125"
                style={{ padding: '8px 16px', fontSize: 13, height: 38, background: 'var(--accent)', color: 'var(--bg-primary)' }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowSaveInput(true); setSaveName(''); }}
              disabled={bins.length === 0}
              className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
              style={{
                height: 38, fontSize: 13,
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
              }}
            >
              Save Layout
            </button>
          )}

          {/* Load */}
          <div className="relative">
            <button
              onClick={() => { setSavedLayouts(getSavedLayouts()); setShowLoadDropdown(!showLoadDropdown); }}
              disabled={getSavedLayouts().length === 0}
              className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
              style={{
                height: 38, fontSize: 13,
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
              }}
            >
              Load Layout {savedLayouts.length > 0 && `(${savedLayouts.length})`}
            </button>
            {showLoadDropdown && savedLayouts.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', zIndex: 20 }}
              >
                {savedLayouts.map((layout) => (
                  <div
                    key={layout.name}
                    className="flex items-center cursor-pointer transition-colors hover:brightness-125"
                    style={{ gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}
                    onClick={() => handleLoadLayout(layout)}
                  >
                    <div className="flex-1">
                      <div className="font-medium" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {layout.name}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.5 }}>
                        {layout.gridCols}x{layout.gridRows} grid, {layout.bins.length} bins
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLayout(layout.name); }}
                      className="opacity-40 hover:opacity-100"
                      style={{ color: 'var(--danger)', fontSize: 13 }}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share Link */}
          <button
            onClick={handleCopyLink}
            disabled={bins.length === 0}
            className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
            style={{
              height: 38, fontSize: 13,
              background: 'var(--bg-tertiary)', color: 'var(--accent)', border: '1px solid var(--border)',
            }}
          >
            Copy Share Link
          </button>
        </div>
      </Section>

      {/* Auto-fill */}
      <Section title="AUTO-FILL">
        <div className="flex items-center" style={{ gap: 6, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Size:</label>
          <input
            type="number" min={1} max={10} value={autoFillSize.w}
            onChange={(e) => setAutoFillSize((s) => ({ ...s, w: Math.max(1, Math.min(10, Number(e.target.value))) }))}
            className="rounded text-center"
            style={{
              width: 42, height: 30, fontSize: 13,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>x</span>
          <input
            type="number" min={1} max={10} value={autoFillSize.d}
            onChange={(e) => setAutoFillSize((s) => ({ ...s, d: Math.max(1, Math.min(10, Number(e.target.value))) }))}
            className="rounded text-center"
            style={{
              width: 42, height: 30, fontSize: 13,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>x</span>
          <input
            type="number" min={1} max={12} value={autoFillSize.h}
            onChange={(e) => setAutoFillSize((s) => ({ ...s, h: Math.max(1, Math.min(12, Number(e.target.value))) }))}
            className="rounded text-center"
            style={{
              width: 42, height: 30, fontSize: 13,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>u</span>
        </div>
        <button
          onClick={handleAutoFill}
          className="w-full rounded font-medium transition-colors hover:brightness-125"
          style={{
            height: 36, fontSize: 13,
            background: 'var(--accent)', color: 'var(--bg-primary)',
          }}
        >
          Fill Empty Space
        </button>
      </Section>

      {/* Bill of Materials */}
      {bins.length > 0 && (
        <Section title="BILL OF MATERIALS">
          <div className="flex flex-col" style={{ gap: 4 }}>
            {bom.map((g) => (
              <div key={`${g.w}x${g.d}x${g.h}`} className="flex items-center justify-between"
                style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>
                  {g.count}x <span style={{ opacity: 0.6 }}>{g.label}</span>
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  {g.w}x{g.d}x{g.h}u
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'var(--text-secondary)' }}>
            <div className="flex justify-between">
              <span>Total volume:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{totalVolume.toFixed(1)} cm³</span>
            </div>
            <div className="flex justify-between" style={{ marginTop: 2 }}>
              <span>PLA estimate:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{totalWeightPLA.toFixed(0)} g</span>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
              <div className="flex items-center" style={{ gap: 4 }}>
                <span>Price:</span>
                <input
                  type="number" min={1} max={200} step={1} value={plaEurKg}
                  onChange={(e) => setPlaEurKg(Math.max(1, Number(e.target.value)))}
                  className="rounded text-center"
                  style={{
                    width: 44, height: 22, fontSize: 11, padding: '2px 4px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <span style={{ opacity: 0.6 }}>€/kg</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', fontWeight: 600 }}>
                {((totalWeightPLA / 1000) * plaEurKg).toFixed(2)} €
              </span>
            </div>
          </div>
        </Section>
      )}

      {/* Tools */}
      <Section title="TOOLS">
        <div className="flex flex-col" style={{ gap: 6 }}>
          <button
            onClick={handleAutoLayout}
            disabled={bins.length === 0}
            className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
            style={{
              height: 36, fontSize: 13,
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}
          >
            Optimize Layout
          </button>
          <button
            onClick={handlePrintLabels}
            disabled={bins.length === 0}
            className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
            style={{
              height: 36, fontSize: 13,
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}
          >
            Print Labels
          </button>
        </div>
      </Section>

      {/* About / Credits */}
      <div className="mt-auto" style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {('serviceWorker' in navigator) && (
          <button
            onClick={forceUpdate}
            className="w-full rounded font-medium transition-colors hover:brightness-125"
            style={{
              height: 36, fontSize: 12, marginBottom: 10,
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            Check for Updates
          </button>
        )}
        <p style={{ fontSize: 10, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          Gridfinity is MIT licensed by{' '}
          <a href="https://www.youtube.com/@ZackFreedman" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>Zack Freedman</a>
          {' '}&middot;{' '}
          <a href="https://gridfinity.xyz" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>gridfinity.xyz</a>
        </p>
        <p style={{ fontSize: 10, marginTop: 4, color: 'var(--border)' }}>
          v1.0.0 &middot; Manifold &middot; Three.js &middot; React
        </p>
      </div>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <h3
        className="font-bold uppercase"
        style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
