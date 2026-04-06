import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

export interface Bin {
  id: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  cornerRadius: number;
  wallThickness: number;
  bottomThickness: number;
  stackingLip: boolean;
  labelShelf: boolean;
  labelWidth: number;
  magnets: boolean;
  screws: boolean;
  dividersX: number;
  dividersY: number;
  color: string;
  label: string;
  group: string;
}

export type ViewMode = '2d' | '3d' | 'split';
export type RenderMode = 'standard' | 'technical' | 'blueprint';

export interface DragState {
  mode: 'idle' | 'placing' | 'dragging';
  binId: string | null;
  origin: { col: number; row: number } | null;
  ghost: { col: number; row: number } | null;
  ghostValid: boolean;
  placingConfig: Omit<Bin, 'id' | 'x' | 'y'> | null;
}

// Clipboard entry: config + relative offset from top-left of selection
export interface ClipboardEntry {
  config: Omit<Bin, 'id' | 'x' | 'y'>;
  dx: number; // offset from anchor bin
  dy: number;
}

interface AppState {
  gridCols: number;
  gridRows: number;

  bins: Bin[];
  selectedBinId: string | null;
  selectedBinIds: string[];
  clipboard: ClipboardEntry[] | null;

  viewMode: ViewMode;
  renderMode: RenderMode;
  showBaseplate: boolean;
  showDimensions: boolean;
  sectionView: boolean;

  dragState: DragState;

  history: Bin[][];
  historyIndex: number;

  // Actions
  addBin: (bin: Omit<Bin, 'id'>) => void;
  removeBin: (id: string) => void;
  updateBin: (id: string, updates: Partial<Bin>) => void;
  moveBin: (id: string, x: number, y: number) => void;
  selectBin: (id: string | null, multi?: boolean) => void;
  copySelected: () => void;
  pasteClipboard: () => number; // returns number of bins pasted (0 = no room)
  setGridSize: (cols: number, rows: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setRenderMode: (mode: RenderMode) => void;
  setShowDimensions: (on: boolean) => void;
  setSectionView: (on: boolean) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  jumpToHistory: (index: number) => void;
  clearAll: () => void;
  setDragState: (state: Partial<DragState>) => void;
  startPlacing: (config: Omit<Bin, 'id' | 'x' | 'y'>) => void;
  cancelPlacing: () => void;
  undo: () => void;
  redo: () => void;
}

const DEFAULT_DRAG: DragState = {
  mode: 'idle',
  binId: null,
  origin: null,
  ghost: null,
  ghostValid: false,
  placingConfig: null,
};

const BIN_COLORS = ['#00d4aa', '#4488ff', '#ff6644', '#ffaa00', '#aa44ff', '#ff44aa'];

function pushHistory(state: AppState): { history: Bin[][]; historyIndex: number } {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.bins)));
  return { history: newHistory, historyIndex: newHistory.length - 1 };
}

export const useStore = create<AppState>()((set, get) => ({
  gridCols: 6,
  gridRows: 6,

  bins: [],
  selectedBinId: null,
  selectedBinIds: [],
  clipboard: null,

  viewMode: 'split',
  renderMode: 'standard' as RenderMode,
  showBaseplate: true,
  showDimensions: false,
  sectionView: false,

  sidebarOpen: true,

  dragState: { ...DEFAULT_DRAG },

  history: [[]],
  historyIndex: 0,

  addBin: (binData) => set((state) => {
    const bin: Bin = {
      ...binData,
      id: uuid(),
      color: binData.color || BIN_COLORS[state.bins.length % BIN_COLORS.length],
    };
    const bins = [...state.bins, bin];
    const hist = pushHistory({ ...state, bins });
    return { bins, ...hist, selectedBinId: bin.id, selectedBinIds: [bin.id] };
  }),

  removeBin: (id) => set((state) => {
    const bins = state.bins.filter((b) => b.id !== id);
    const hist = pushHistory({ ...state, bins });
    const newIds = state.selectedBinIds.filter((sid) => sid !== id);
    return {
      bins,
      ...hist,
      selectedBinId: state.selectedBinId === id ? (newIds[newIds.length - 1] ?? null) : state.selectedBinId,
      selectedBinIds: newIds,
    };
  }),

  updateBin: (id, updates) => set((state) => {
    const bins = state.bins.map((b) => (b.id === id ? { ...b, ...updates } : b));
    const hist = pushHistory({ ...state, bins });
    return { bins, ...hist };
  }),

  moveBin: (id, x, y) => set((state) => {
    const bins = state.bins.map((b) => (b.id === id ? { ...b, x, y } : b));
    const hist = pushHistory({ ...state, bins });
    return { bins, ...hist };
  }),

  selectBin: (id, multi) => set((state) => {
    if (!id) return { selectedBinId: null, selectedBinIds: [] };
    if (multi) {
      const already = state.selectedBinIds.includes(id);
      const newIds = already
        ? state.selectedBinIds.filter((sid) => sid !== id)
        : [...state.selectedBinIds, id];
      return {
        selectedBinId: already ? (newIds[newIds.length - 1] ?? null) : id,
        selectedBinIds: newIds,
      };
    }
    return { selectedBinId: id, selectedBinIds: [id] };
  }),

  copySelected: () => set((state) => {
    const selected = state.bins.filter((b) => state.selectedBinIds.includes(b.id));
    if (selected.length === 0) return state;
    // Anchor = top-left bin (min x, then min y)
    const anchorX = Math.min(...selected.map((b) => b.x));
    const anchorY = Math.min(...selected.map((b) => b.y));
    const clipboard: ClipboardEntry[] = selected.map(({ id, x, y, ...config }) => ({
      config,
      dx: x - anchorX,
      dy: y - anchorY,
    }));
    return { clipboard };
  }),

  pasteClipboard: () => {
    const state = get();
    const { clipboard, bins, gridCols, gridRows } = state;
    if (!clipboard || clipboard.length === 0) return 0;

    // Find first origin (col, row) where the entire group fits without collision
    const groupW = Math.max(...clipboard.map((e) => e.dx + e.config.w));
    const groupD = Math.max(...clipboard.map((e) => e.dy + e.config.d));

    let originX = -1, originY = -1;
    outer: for (let row = 0; row <= gridRows - groupD; row++) {
      for (let col = 0; col <= gridCols - groupW; col++) {
        // Check every bin in the group against existing bins
        let fits = true;
        for (const entry of clipboard) {
          const cx = col + entry.dx;
          const cy = row + entry.dy;
          // Out of bounds
          if (cx + entry.config.w > gridCols || cy + entry.config.d > gridRows) { fits = false; break; }
          // Collision with existing bins
          for (const b of bins) {
            if (cx < b.x + b.w && cx + entry.config.w > b.x &&
                cy < b.y + b.d && cy + entry.config.d > b.y) {
              fits = false; break;
            }
          }
          if (!fits) break;
        }
        if (fits) { originX = col; originY = row; break outer; }
      }
    }

    if (originX === -1) return 0; // no room

    // Place all bins; collect new ids for selection
    const newIds: string[] = [];
    set((state2) => {
      let newBins = [...state2.bins];
      const addedHist = pushHistory({ ...state2, bins: newBins });
      for (const entry of clipboard) {
        const bin: Bin = {
          ...entry.config,
          id: uuid(),
          x: originX + entry.dx,
          y: originY + entry.dy,
          color: entry.config.color || BIN_COLORS[newBins.length % BIN_COLORS.length],
        };
        newBins = [...newBins, bin];
        newIds.push(bin.id);
      }
      return {
        bins: newBins,
        ...addedHist,
        selectedBinId: newIds[newIds.length - 1] ?? null,
        selectedBinIds: newIds,
      };
    });
    return clipboard.length;
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  jumpToHistory: (index) => set((state) => {
    if (index < 0 || index >= state.history.length) return state;
    return {
      bins: JSON.parse(JSON.stringify(state.history[index])),
      historyIndex: index,
    };
  }),

  setGridSize: (cols, rows) => set({ gridCols: cols, gridRows: rows }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setRenderMode: (mode) => set({ renderMode: mode }),

  setShowDimensions: (on) => set({ showDimensions: on }),

  setSectionView: (on) => set({ sectionView: on }),

  clearAll: () => set((state) => {
    const hist = pushHistory({ ...state, bins: [] });
    return { bins: [], selectedBinId: null, selectedBinIds: [], ...hist, dragState: { ...DEFAULT_DRAG } };
  }),

  setDragState: (partial) => set((state) => ({
    dragState: { ...state.dragState, ...partial },
  })),

  startPlacing: (config) => set({
    dragState: {
      mode: 'placing',
      binId: null,
      origin: null,
      ghost: null,
      ghostValid: false,
      placingConfig: config,
    },
  }),

  cancelPlacing: () => set({ dragState: { ...DEFAULT_DRAG } }),

  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const newIndex = state.historyIndex - 1;
    return {
      bins: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const newIndex = state.historyIndex + 1;
    return {
      bins: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
    };
  }),
}));
