import { useState, useRef } from 'react';
import { useStore, type Bin } from '../store/useStore';
import { GF, GRID_PRESETS, BIN_PRESETS, BIN_GROUPS, LAYOUT_TEMPLATES, type LayoutTemplate } from '../gridfinity/constants';
import { checkCollision } from '../utils/collision';
import BinConfigurator from './BinConfigurator';
import { resetOnboarding } from './OnboardingOverlay';

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
      lb: b.label, gr: b.group || '',
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
        color: '', label: b.lb || '', group: b.gr || '',
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
  const selectedBinIds = useStore((s) => s.selectedBinIds);
  const selectBin = useStore((s) => s.selectBin);
  const addBin = useStore((s) => s.addBin);
  const removeBin = useStore((s) => s.removeBin);
  const updateBin = useStore((s) => s.updateBin);
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showGistConfirm, setShowGistConfirm] = useState(false);
  const [binsCollapsed, setBinsCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [tokenInput, setTokenInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      group: '',
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
            group: '',
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
      addBin({ ...bin, group: (bin as any).group || '' });
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
            group: '',
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

  // ── BOM CSV Export ──

  function handleExportBOMCSV() {
    if (bom.length === 0) return;
    const headers = ['Type','Width (u)','Depth (u)','Height (u)','Count','Volume/unit (cm3)','Total volume (cm3)','Weight PLA (g)','Cost (EUR)'];
    const rows = bom.map((g) => {
      const totalVol = g.volumeCm3 * g.count;
      const weight = totalVol * 1.24;
      const cost = (weight / 1000) * plaEurKg;
      return [
        `"${g.label.replace(/"/g, '""')}"`,
        g.w, g.d, g.h, g.count,
        g.volumeCm3.toFixed(2), totalVol.toFixed(2),
        weight.toFixed(1), cost.toFixed(2),
      ].join(',');
    });
    const totalWeight = totalVolume * 1.24;
    rows.push('');
    rows.push(`"TOTAL",,,,${bins.length},,${totalVolume.toFixed(2)},${totalWeight.toFixed(1)},${((totalWeight / 1000) * plaEurKg).toFixed(2)}`);
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridfinity-bom-${gridCols}x${gridRows}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('BOM exported as CSV');
  }

  // ── JSON Export/Import ──

  function handleExportJSON() {
    const { bins: allBins, gridCols: gc, gridRows: gr } = useStore.getState();
    const data = {
      version: '1.0',
      gridCols: gc,
      gridRows: gr,
      bins: allBins.map(({ id, ...rest }) => rest),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridfinity-layout-${gc}x${gr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON exported');
  }

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.gridCols || !data.gridRows || !Array.isArray(data.bins)) {
          showToast('Invalid layout file');
          return;
        }
        clearAll();
        setGridSize(data.gridCols, data.gridRows);
        for (const bin of data.bins) {
          addBin({ ...bin, group: bin.group || '' });
        }
        showToast(`Imported ${data.bins.length} bins`);
      } catch {
        showToast('Failed to parse JSON');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  }

  // ── Template loading ──

  function handleLoadTemplate(template: LayoutTemplate) {
    clearAll();
    setGridSize(template.gridCols, template.gridRows);
    for (const b of template.bins) {
      addBin({
        x: b.x, y: b.y, w: b.w, d: b.d, h: b.h,
        cornerRadius: GF.BIN_CORNER_RADIUS,
        wallThickness: GF.WALL_THICKNESS,
        bottomThickness: GF.BOTTOM_THICKNESS,
        stackingLip: false, labelShelf: false, labelWidth: GF.LABEL_DEFAULT_WIDTH,
        magnets: false, screws: false,
        dividersX: b.dividersX, dividersY: b.dividersY,
        color: '', label: b.label, group: b.group || '',
      });
    }
    setShowTemplates(false);
    showToast(`Loaded "${template.name}"`);
  }

  // ── GitHub Gist export (token encrypted in localStorage) ──

  const GIST_TOKEN_KEY = 'gridfinity-gh-token-enc';

  async function deriveKey(): Promise<CryptoKey> {
    const salt = new TextEncoder().encode('gridfinity-gist-v1-' + window.location.origin);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', salt, 'PBKDF2', false, ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async function encryptToken(token: string): Promise<string> {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(token),
    );
    const buf = new Uint8Array(iv.length + new Uint8Array(enc).length);
    buf.set(iv);
    buf.set(new Uint8Array(enc), iv.length);
    return btoa(String.fromCharCode(...buf));
  }

  async function decryptToken(stored: string): Promise<string | null> {
    try {
      const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
      const iv = raw.slice(0, 12);
      const data = raw.slice(12);
      const key = await deriveKey();
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(dec);
    } catch {
      return null;
    }
  }

  function handleGistExport() {
    setShowGistConfirm(true);
  }

  async function handleGistConfirmed() {
    setShowGistConfirm(false);

    const stored = localStorage.getItem(GIST_TOKEN_KEY);
    const token = stored ? await decryptToken(stored) : null;

    if (!token) {
      setTokenInput('');
      setShowTokenModal(true);
      return;
    }

    await doGistUpload(token);
  }

  async function doGistUpload(token: string) {
    const { bins: allBins, gridCols: gc, gridRows: gr } = useStore.getState();
    const data = {
      version: '1.0',
      gridCols: gc,
      gridRows: gr,
      bins: allBins.map(({ id, ...rest }) => rest),
      exportedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(data, null, 2);

    try {
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: `Gridfinity Layout — ${gc}x${gr} grid, ${allBins.length} bins`,
          public: true,
          files: {
            [`gridfinity-${gc}x${gr}.json`]: { content },
          },
        }),
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(GIST_TOKEN_KEY);
        showToast('Invalid token — cleared');
        return;
      }

      if (!res.ok) {
        showToast(`Gist failed (${res.status})`);
        return;
      }

      // Token works — encrypt and save
      const encrypted = await encryptToken(token);
      localStorage.setItem(GIST_TOKEN_KEY, encrypted);

      const gist = await res.json();
      const gistUrl = gist.html_url;

      try {
        await navigator.clipboard.writeText(gistUrl);
        showToast('Gist created! URL copied');
      } catch {
        showToast('Gist created!');
        window.open(gistUrl, '_blank');
      }
    } catch {
      showToast('Network error');
    }
  }

  async function handleTokenSubmit() {
    const token = tokenInput.trim();
    if (!token) return;
    setShowTokenModal(false);
    await doGistUpload(token);
  }

  // ── Drag bin from sidebar ──

  function handleDragStartPreset(e: React.DragEvent, preset: typeof BIN_PRESETS[number]) {
    e.dataTransfer.setData('application/gridfinity-preset', JSON.stringify(preset));
    e.dataTransfer.effectAllowed = 'copy';
    // Store size globally so GridCanvas2D can read it during dragover
    (window as any).__gridfinityDragPreset = { w: preset.w, d: preset.d };
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
      className="flex flex-col w-full h-full overflow-y-auto relative"
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
            zIndex: 9999, padding: '10px 20px', fontSize: 11,
          }}
        >
          {toast}
        </div>
      )}

      {/* GitHub Token Modal */}
      {showTokenModal && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 10000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowTokenModal(false)}
        >
          <div
            className="rounded-xl shadow-2xl"
            style={{
              width: 380, padding: 24,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold" style={{ fontSize: 15, marginBottom: 12, color: 'var(--text-primary)' }}>
              GitHub Token
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
              A Personal Access Token with <strong style={{ color: 'var(--accent)' }}>gist</strong> scope is required.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Create one at{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=gist&description=Gridfinity+Builder"
                target="_blank" rel="noopener"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                github.com/settings/tokens
              </a>
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTokenSubmit(); if (e.key === 'Escape') setShowTokenModal(false); }}
              placeholder="ghp_xxxxxxxxxxxx"
              autoFocus
              className="w-full rounded"
              style={{
                height: 38, padding: '8px 12px', fontSize: 13,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, opacity: 0.7 }}>
              Encrypted with AES-256 before saving to localStorage.
            </p>
            <div className="flex justify-end" style={{ gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setShowTokenModal(false)}
                className="rounded transition-colors hover:brightness-125"
                style={{
                  padding: '8px 16px', fontSize: 13,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTokenSubmit}
                disabled={!tokenInput.trim()}
                className="rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
                style={{
                  padding: '8px 20px', fontSize: 13,
                  background: 'var(--accent)', color: 'var(--bg-primary)',
                }}
              >
                Save & Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gist Confirmation Modal */}
      {showGistConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 10000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowGistConfirm(false)}
        >
          <div
            className="rounded-xl shadow-2xl"
            style={{
              width: 380, padding: 24,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold" style={{ fontSize: 15, marginBottom: 12, color: 'var(--text-primary)' }}>
              Share as Public Gist
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              This will create a <strong style={{ color: 'var(--text-primary)' }}>public</strong> GitHub Gist
              with your current layout:
            </p>
            <div
              className="rounded"
              style={{
                padding: '10px 14px', marginBottom: 14,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)',
              }}
            >
              <div className="flex justify-between" style={{ marginBottom: 4 }}>
                <span>Grid</span>
                <span style={{ color: 'var(--text-primary)' }}>{gridCols} x {gridRows}</span>
              </div>
              <div className="flex justify-between" style={{ marginBottom: 4 }}>
                <span>Bins</span>
                <span style={{ color: 'var(--text-primary)' }}>{bins.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Visibility</span>
                <span style={{ color: '#ffaa00' }}>Public</span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7, marginBottom: 16 }}>
              Anyone with the link will be able to see your layout.
            </p>
            <div className="flex justify-end" style={{ gap: 8 }}>
              <button
                onClick={() => setShowGistConfirm(false)}
                className="rounded transition-colors hover:brightness-125"
                style={{
                  padding: '8px 16px', fontSize: 13,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGistConfirmed}
                className="rounded font-medium transition-colors hover:brightness-125"
                style={{
                  padding: '8px 20px', fontSize: 13,
                  background: 'var(--accent)', color: 'var(--bg-primary)',
                }}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printer / Baseplate */}
      <Section title="PRINTER / BASEPLATE" data-onboarding="baseplate">
        <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {GRID_PRESETS.map((p) => {
            const active = gridCols === p.cols && gridRows === p.rows;
            return (
              <button
                key={p.name}
                onClick={() => setGridSize(p.cols, p.rows)}
                className="transition-colors hover:brightness-125"
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11,
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
          <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Grid:</label>
          <input
            type="number" min={1} max={20} value={gridCols}
            onChange={(e) => setGridSize(Number(e.target.value), gridRows)}
            className="rounded text-center"
            style={{
              width: 46, height: 28, padding: '4px 6px', fontSize: 11,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>x</span>
          <input
            type="number" min={1} max={20} value={gridRows}
            onChange={(e) => setGridSize(gridCols, Number(e.target.value))}
            className="rounded text-center"
            style={{
              width: 46, height: 28, padding: '4px 6px', fontSize: 11,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span className="ml-auto" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{plateMM}</span>
        </div>
      </Section>

      {/* Add Bin */}
      <Section title="ADD BIN" data-onboarding="add-bin">
        {dragState.mode === 'placing' ? (
          <div className="text-center" style={{ padding: '12px 0', color: 'var(--accent)' }}>
            <div style={{ marginBottom: 10, fontSize: 11 }}>Click on grid to place bin...</div>
            <button
              onClick={() => useStore.getState().cancelPlacing()}
              className="rounded transition-colors hover:brightness-125"
              style={{
                padding: '8px 20px', fontSize: 11,
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
                height: 30, fontSize: 11, marginBottom: 10,
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
                    draggable
                    onDragStart={(e) => handleDragStartPreset(e, p)}
                    className="flex-1 rounded text-left transition-colors hover:brightness-125"
                    style={{
                      minHeight: 34, padding: '6px 10px', fontSize: 11,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                      cursor: 'grab',
                    }}
                    title="Click to place, or drag to grid"
                  >
                    {p.name}
                    <span style={{ opacity: 0.4, marginLeft: 8, fontSize: 10 }}>
                      {p.w}x{p.d}x{p.h}u
                    </span>
                  </button>
                  <button
                    onClick={() => handleQuickAdd(p)}
                    className="rounded transition-colors hover:brightness-125 flex items-center justify-center shrink-0"
                    style={{
                      width: 34, minHeight: 34, fontSize: 16, fontWeight: 600,
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
      <div data-onboarding="bins" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setBinsCollapsed(!binsCollapsed)}
          className="w-full flex items-center justify-between transition-colors"
          style={{
            padding: '10px 16px',
            background: binsCollapsed ? 'rgba(0, 212, 170, 0.06)' : 'none',
            border: 'none', cursor: 'pointer',
            borderLeft: binsCollapsed ? '3px solid var(--accent)' : '3px solid transparent',
          }}
        >
          <div className="flex items-center" style={{ gap: 8 }}>
            <h3
              className="font-bold uppercase"
              style={{
                fontSize: 12, letterSpacing: '0.05em', margin: 0,
                color: binsCollapsed ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
              }}
            >
              BINS
            </h3>
            <span
              className="rounded-full font-bold"
              style={{
                fontSize: 10, minWidth: 20, height: 18, lineHeight: '18px',
                textAlign: 'center', padding: '0 6px',
                background: bins.length > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: bins.length > 0 ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
            >
              {bins.length}
            </span>
          </div>
          <span style={{
            fontSize: 10, color: binsCollapsed ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'transform 0.2s',
            display: 'inline-block', transform: binsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </button>
        {!binsCollapsed && (
          <div style={{ padding: '0 16px 12px' }}>
            {bins.length === 0 ? (
              <p className="text-center" style={{ padding: '12px 0', opacity: 0.4, fontSize: 11 }}>No bins placed yet</p>
            ) : (() => {
              // Group bins by group id
              const grouped: { groupId: string; grp: typeof BIN_GROUPS[number] | null; items: typeof bins }[] = [];
              const groupMap = new Map<string, typeof bins>();
              for (const bin of bins) {
                const gid = bin.group || '';
                if (!groupMap.has(gid)) groupMap.set(gid, []);
                groupMap.get(gid)!.push(bin);
              }
              // Sort: named groups first (alphabetical), ungrouped last
              const sortedKeys = [...groupMap.keys()].sort((a, b) => {
                if (!a) return 1;
                if (!b) return -1;
                return a.localeCompare(b);
              });
              for (const gid of sortedKeys) {
                const grp = gid ? BIN_GROUPS.find((g) => g.id === gid) || null : null;
                grouped.push({ groupId: gid, grp, items: groupMap.get(gid)! });
              }

              const hasMultipleGroups = grouped.length > 1 || (grouped.length === 1 && grouped[0].groupId !== '');

              return (
                <div className="flex flex-col" style={{ gap: 2 }}>
                  {grouped.map(({ groupId, grp, items }) => {
                    const isGroupCollapsed = collapsedGroups[groupId] ?? false;
                    const groupLabel = grp?.label || 'Ungrouped';
                    const groupColor = grp?.color || 'var(--text-secondary)';

                    return (
                      <div key={groupId || '__none'}>
                        {/* Group sub-header (only if multiple groups exist) */}
                        {hasMultipleGroups && (
                          <button
                            onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))}
                            className="w-full flex items-center transition-colors"
                            style={{
                              gap: 6, padding: '4px 6px', marginTop: 4,
                              background: 'none', border: 'none', cursor: 'pointer',
                            }}
                          >
                            <span style={{
                              fontSize: 8, color: groupColor,
                              transition: 'transform 0.15s',
                              display: 'inline-block',
                              transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            }}>
                              ▼
                            </span>
                            {grp?.color && (
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: grp.color, display: 'inline-block', flexShrink: 0,
                              }} />
                            )}
                            <span style={{ fontSize: 10, fontWeight: 600, color: groupColor }}>
                              {groupLabel}
                            </span>
                            <span style={{
                              fontSize: 9, color: 'var(--text-secondary)', opacity: 0.5,
                              marginLeft: 'auto',
                            }}>
                              {items.length}
                            </span>
                          </button>
                        )}

                        {/* Bin items */}
                        {!(hasMultipleGroups && isGroupCollapsed) && (
                          <div className="flex flex-col" style={{ gap: 2 }}>
                            {items.map((bin) => {
                              const isSelected = selectedBinIds.includes(bin.id);
                              return (
                                <div
                                  key={bin.id}
                                  onClick={(e) => selectBin(bin.id, e.shiftKey)}
                                  className="flex items-center rounded cursor-pointer transition-colors"
                                  style={{
                                    gap: 8, padding: '5px 10px', minHeight: 28,
                                    marginLeft: hasMultipleGroups ? 12 : 0,
                                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                                    border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                                  }}
                                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'rgba(255,255,255,0.03)'); }}
                                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent'); }}
                                >
                                  <div className="shrink-0" style={{ width: 12, height: 12, borderRadius: 3, background: bin.color }} />
                                  <div className="flex-1 truncate" style={{ fontSize: 11 }}>
                                    {bin.label || 'Bin'}
                                    <span style={{ fontSize: 10, opacity: 0.45, marginLeft: 6 }}>
                                      {bin.w}x{bin.d}x{bin.h}u
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 10, opacity: 0.4 }}>
                                    ({bin.x},{bin.y})
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeBin(bin.id); }}
                                    className="opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center"
                                    style={{ color: 'var(--danger)', width: 18, height: 18, fontSize: 12 }}
                                  >
                                    x
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Configurator (only for single selection) */}
      {selectedBin && selectedBinIds.length === 1 && <BinConfigurator bin={selectedBin} />}

      {/* Multi-selection bulk actions */}
      {selectedBinIds.length > 1 && (
        <div className="animate-slide-up" style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h4
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}
          >
            {selectedBinIds.length} BINS SELECTED
          </h4>

          {/* Bulk Group */}
          <h4
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginTop: 12, marginBottom: 8 }}
          >
            GROUP
          </h4>
          <div className="flex flex-wrap" style={{ gap: 4 }}>
            {BIN_GROUPS.map((g) => {
              // Check if all selected bins share this group
              const selectedBins = bins.filter((b) => selectedBinIds.includes(b.id));
              const allSame = selectedBins.every((b) => (b.group || '') === g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    for (const id of selectedBinIds) {
                      updateBin(id, { group: g.id });
                    }
                  }}
                  className="rounded transition-colors hover:brightness-125"
                  style={{
                    padding: '4px 10px', fontSize: 11,
                    background: allSame
                      ? (g.color ? g.color + '33' : 'var(--bg-tertiary)')
                      : 'var(--bg-tertiary)',
                    border: allSame
                      ? `1px solid ${g.color || 'var(--accent)'}`
                      : '1px solid var(--border)',
                    color: allSame
                      ? (g.color || 'var(--text-primary)')
                      : 'var(--text-secondary)',
                    fontWeight: allSame ? 600 : 400,
                  }}
                >
                  {g.color && (
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: g.color, marginRight: 4, verticalAlign: 'middle',
                    }} />
                  )}
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* Bulk Color */}
          <h4
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginTop: 12, marginBottom: 8 }}
          >
            COLOR
          </h4>
          <div className="flex" style={{ gap: 6 }}>
            {['#00d4aa', '#4488ff', '#ff6644', '#ffaa00', '#aa44ff', '#ff44aa'].map((c) => (
              <button
                key={c}
                onClick={() => {
                  for (const id of selectedBinIds) {
                    updateBin(id, { color: c });
                  }
                }}
                className="transition-transform"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: c,
                  border: '2px solid transparent',
                }}
              />
            ))}
          </div>

          {/* Bulk Delete */}
          <button
            onClick={() => {
              for (const id of [...selectedBinIds]) {
                removeBin(id);
              }
            }}
            className="w-full rounded font-medium transition-colors hover:brightness-125"
            style={{
              height: 30, fontSize: 11, marginTop: 14,
              background: 'rgba(255, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 68, 68, 0.3)',
            }}
          >
            Delete {selectedBinIds.length} Bins
          </button>
        </div>
      )}

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
                  padding: '8px 12px', fontSize: 11, height: 32,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={handleSaveLayout}
                className="rounded font-medium hover:brightness-125"
                style={{ padding: '8px 16px', fontSize: 11, height: 32, background: 'var(--accent)', color: 'var(--bg-primary)' }}
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
                height: 32, fontSize: 11,
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
                height: 32, fontSize: 11,
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
                      <div className="font-medium" style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                        {layout.name}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.5 }}>
                        {layout.gridCols}x{layout.gridRows} grid, {layout.bins.length} bins
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLayout(layout.name); }}
                      className="opacity-40 hover:opacity-100"
                      style={{ color: 'var(--danger)', fontSize: 11 }}
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
              height: 32, fontSize: 11,
              background: 'var(--bg-tertiary)', color: 'var(--accent)', border: '1px solid var(--border)',
            }}
          >
            Copy Share Link
          </button>
        </div>
      </Section>

      {/* Templates */}
      <Section title="TEMPLATES">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full rounded font-medium transition-colors hover:brightness-125"
          style={{
            height: 32, fontSize: 11,
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
          }}
        >
          {showTemplates ? 'Hide Templates' : `Browse Templates (${LAYOUT_TEMPLATES.length})`}
        </button>
        {showTemplates && (
          <div className="flex flex-col" style={{ gap: 6, marginTop: 8 }}>
            {LAYOUT_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => handleLoadTemplate(t)}
                className="w-full rounded text-left transition-colors hover:brightness-125"
                style={{
                  padding: '8px 12px', fontSize: 11,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                }}
              >
                <div className="font-medium">{t.name}</div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>
                  {t.gridCols}x{t.gridRows} grid, {t.bins.length} bins — {t.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Export / Import JSON */}
      <Section title="EXPORT / IMPORT">
        <div className="flex flex-col" style={{ gap: 6 }}>
          <button
            onClick={handleExportJSON}
            disabled={bins.length === 0}
            className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
            style={{
              height: 30, fontSize: 11,
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}
          >
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded font-medium transition-colors hover:brightness-125"
            style={{
              height: 30, fontSize: 11,
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />
          <button
            onClick={handleGistExport}
            disabled={bins.length === 0}
            className="w-full rounded font-medium transition-colors hover:brightness-125 disabled:opacity-30"
            style={{
              height: 30, fontSize: 11,
              background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            Share as GitHub Gist
          </button>
        </div>
      </Section>

      {/* Auto-fill */}
      <Section title="AUTO-FILL">
        <div className="flex items-center" style={{ gap: 6, marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Size:</label>
          <input
            type="number" min={1} max={10} value={autoFillSize.w}
            onChange={(e) => setAutoFillSize((s) => ({ ...s, w: Math.max(1, Math.min(10, Number(e.target.value))) }))}
            className="rounded text-center"
            style={{
              width: 42, height: 30, fontSize: 11,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>x</span>
          <input
            type="number" min={1} max={10} value={autoFillSize.d}
            onChange={(e) => setAutoFillSize((s) => ({ ...s, d: Math.max(1, Math.min(10, Number(e.target.value))) }))}
            className="rounded text-center"
            style={{
              width: 42, height: 30, fontSize: 11,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>x</span>
          <input
            type="number" min={1} max={12} value={autoFillSize.h}
            onChange={(e) => setAutoFillSize((s) => ({ ...s, h: Math.max(1, Math.min(12, Number(e.target.value))) }))}
            className="rounded text-center"
            style={{
              width: 42, height: 30, fontSize: 11,
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
            height: 30, fontSize: 11,
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
          <button
            onClick={handleExportBOMCSV}
            className="w-full rounded font-medium transition-colors hover:brightness-125"
            style={{
              height: 30, fontSize: 11, marginTop: 10,
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}
          >
            Export BOM as CSV
          </button>
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
              height: 30, fontSize: 11,
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
              height: 30, fontSize: 11,
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
              height: 30, fontSize: 12, marginBottom: 10,
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
        <button
          onClick={() => { resetOnboarding(); window.location.reload(); }}
          className="transition-colors hover:brightness-125"
          style={{ fontSize: 10, marginTop: 6, color: 'var(--text-secondary)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Restart Tutorial
        </button>
      </div>
    </nav>
  );
}

function Section({ title, children, ...rest }: { title: string; children: React.ReactNode; 'data-onboarding'?: string }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }} {...rest}>
      <h3
        className="font-bold uppercase"
        style={{ fontSize: 12, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
