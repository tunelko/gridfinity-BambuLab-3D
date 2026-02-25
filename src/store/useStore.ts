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

interface AppState {
  gridCols: number;
  gridRows: number;

  bins: Bin[];
  selectedBinId: string | null;

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
  selectBin: (id: string | null) => void;
  setGridSize: (cols: number, rows: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setRenderMode: (mode: RenderMode) => void;
  setShowDimensions: (on: boolean) => void;
  setSectionView: (on: boolean) => void;
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

  viewMode: 'split',
  renderMode: 'standard' as RenderMode,
  showBaseplate: true,
  showDimensions: false,
  sectionView: false,

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
    return { bins, ...hist, selectedBinId: bin.id };
  }),

  removeBin: (id) => set((state) => {
    const bins = state.bins.filter((b) => b.id !== id);
    const hist = pushHistory({ ...state, bins });
    return {
      bins,
      ...hist,
      selectedBinId: state.selectedBinId === id ? null : state.selectedBinId,
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

  selectBin: (id) => set({ selectedBinId: id }),

  setGridSize: (cols, rows) => set({ gridCols: cols, gridRows: rows }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setRenderMode: (mode) => set({ renderMode: mode }),

  setShowDimensions: (on) => set({ showDimensions: on }),

  setSectionView: (on) => set({ sectionView: on }),

  clearAll: () => set((state) => {
    const hist = pushHistory({ ...state, bins: [] });
    return { bins: [], selectedBinId: null, ...hist, dragState: { ...DEFAULT_DRAG } };
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
