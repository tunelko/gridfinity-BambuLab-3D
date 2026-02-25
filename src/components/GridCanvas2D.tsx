import { useRef, useState, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { CELL_PX, screenToGrid } from '../utils/gridMath';
import { checkCollision } from '../utils/collision';
import { GF, BIN_GROUPS } from '../gridfinity/constants';

const DRAG_THRESHOLD = 5; // px movement to start drag
const HANDLE_SIZE = 8;    // px size of resize handles
const HANDLE_LENGTH = 20; // px length of edge handles

type ResizeEdge = 'e' | 'w' | 'n' | 's';

interface ResizeState {
  binId: string;
  edge: ResizeEdge;
  origX: number; origY: number; origW: number; origD: number;
  ghostX: number; ghostY: number; ghostW: number; ghostD: number;
  startClientX: number; startClientY: number;
}

export default function GridCanvas2D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bins = useStore((s) => s.bins);
  const gridCols = useStore((s) => s.gridCols);
  const gridRows = useStore((s) => s.gridRows);
  const selectedBinId = useStore((s) => s.selectedBinId);
  const selectBin = useStore((s) => s.selectBin);
  const addBin = useStore((s) => s.addBin);
  const removeBin = useStore((s) => s.removeBin);
  const moveBin = useStore((s) => s.moveBin);
  const updateBin = useStore((s) => s.updateBin);
  const dragState = useStore((s) => s.dragState);
  const cancelPlacing = useStore((s) => s.cancelPlacing);

  // Pan & zoom
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Hover
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);

  // Drag state
  const [drag, setDrag] = useState<{
    binId: string;
    originCol: number;
    originRow: number;
    ghostCol: number;
    ghostRow: number;
    started: boolean; // true once we moved past threshold
  } | null>(null);
  const mouseDownRef = useRef<{ x: number; y: number; binId: string; col: number; row: number } | null>(null);

  // Snap-back animation
  const [snapBack, setSnapBack] = useState<{
    binId: string;
    fromCol: number; fromRow: number;
    toCol: number; toRow: number;
  } | null>(null);

  // Resize state
  const [resize, setResize] = useState<ResizeState | null>(null);

  const cellSize = CELL_PX * zoom;
  const gridW = gridCols * cellSize;
  const gridH = gridRows * cellSize;

  const getGridCoord = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return screenToGrid(
      { x: clientX - rect.left, y: clientY - rect.top },
      pan,
      zoom,
    );
  }, [pan, zoom]);

  // ── Hit-test resize handles ──
  const hitTestHandle = useCallback((clientX: number, clientY: number): { binId: string; edge: ResizeEdge } | null => {
    if (!containerRef.current || !selectedBinId) return null;
    const bin = bins.find((b) => b.id === selectedBinId);
    if (!bin) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const bx = pan.x + bin.x * cellSize;
    const by = pan.y + bin.y * cellSize;
    const bw = bin.w * cellSize;
    const bh = bin.d * cellSize;

    const hitPad = Math.max(HANDLE_SIZE, 6); // hit area in px

    // East edge (right)
    if (Math.abs(mx - (bx + bw)) < hitPad && my > by + hitPad && my < by + bh - hitPad) {
      return { binId: bin.id, edge: 'e' };
    }
    // West edge (left)
    if (Math.abs(mx - bx) < hitPad && my > by + hitPad && my < by + bh - hitPad) {
      return { binId: bin.id, edge: 'w' };
    }
    // South edge (bottom)
    if (Math.abs(my - (by + bh)) < hitPad && mx > bx + hitPad && mx < bx + bw - hitPad) {
      return { binId: bin.id, edge: 's' };
    }
    // North edge (top)
    if (Math.abs(my - by) < hitPad && mx > bx + hitPad && mx < bx + bw - hitPad) {
      return { binId: bin.id, edge: 'n' };
    }

    return null;
  }, [selectedBinId, bins, pan, cellSize]);

  // ── Hit-test rotate handle ──
  const hitTestRotate = useCallback((clientX: number, clientY: number): boolean => {
    if (!containerRef.current || !selectedBinId) return false;
    const bin = bins.find((b) => b.id === selectedBinId);
    if (!bin || bin.w === bin.d) return false;

    const rect = containerRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const bx = pan.x + bin.x * cellSize;
    const by = pan.y + bin.y * cellSize;
    const bw = bin.w * cellSize;

    // Rotate handle is at top-right corner (bx + bw + 2, by - 2), radius 10
    const cx = bx + bw + 2;
    const cy = by - 2;
    const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
    return dist <= 14; // generous hit area
  }, [selectedBinId, bins, pan, cellSize]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const state = useStore.getState();

      // Escape: cancel placing, drag, or resize
      if (e.key === 'Escape') {
        if (state.dragState.mode === 'placing') {
          cancelPlacing();
        }
        if (drag) {
          setDrag(null);
          mouseDownRef.current = null;
        }
        if (resize) {
          setResize(null);
        }
        return;
      }

      // Delete/Backspace: remove selected bin
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedBinId) {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
        removeBin(state.selectedBinId);
        return;
      }

      // R: rotate placing ghost or selected bin (swap W↔D)
      if (e.key === 'r' || e.key === 'R') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
        if (state.dragState.mode === 'placing' && state.dragState.placingConfig) {
          const cfg = state.dragState.placingConfig;
          useStore.getState().startPlacing({ ...cfg, w: cfg.d, d: cfg.w });
        } else if (state.selectedBinId) {
          const bin = state.bins.find((b) => b.id === state.selectedBinId);
          if (bin && bin.w !== bin.d) {
            const collision = checkCollision(
              state.bins,
              { x: bin.x, y: bin.y, w: bin.d, d: bin.w },
              bin.id,
              state.gridCols,
              state.gridRows,
            );
            if (!collision) {
              useStore.getState().updateBin(bin.id, { w: bin.d, d: bin.w });
            }
          }
        }
        return;
      }

      // Ctrl+Z / Ctrl+Shift+Z: undo/redo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          useStore.getState().redo();
        } else {
          useStore.getState().undo();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drag, resize, cancelPlacing, removeBin]);

  // ── Wheel zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, zoom * delta));

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setPan({
      x: mx - (mx - pan.x) * (newZoom / zoom),
      y: my - (my - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  }, [zoom, pan]);

  // ── Mouse down ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle click or shift+left = pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return;

    // Check rotate handle hit first
    if (hitTestRotate(e.clientX, e.clientY)) {
      const bin = bins.find((b) => b.id === selectedBinId);
      if (bin) {
        const collision = checkCollision(
          bins,
          { x: bin.x, y: bin.y, w: bin.d, d: bin.w },
          bin.id,
          gridCols,
          gridRows,
        );
        if (!collision) {
          updateBin(bin.id, { w: bin.d, d: bin.w });
        }
      }
      return;
    }

    // Check divider +/- button hits
    if (selectedBinId && containerRef.current) {
      const bin = bins.find((b) => b.id === selectedBinId);
      if (bin) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const bx = pan.x + bin.x * cellSize;
        const by = pan.y + bin.y * cellSize;
        const bw = bin.w * cellSize;
        const bh = bin.d * cellSize;
        const btnR = 12; // hit radius

        // X dividers controls (bottom center)
        const dxCx = bx + bw / 2;
        const dxCy = by + bh + 14;
        if (Math.sqrt((mx - (dxCx - 16)) ** 2 + (my - dxCy) ** 2) <= btnR && bin.dividersX > 0) {
          updateBin(bin.id, { dividersX: bin.dividersX - 1 }); return;
        }
        if (Math.sqrt((mx - (dxCx + 16)) ** 2 + (my - dxCy) ** 2) <= btnR && bin.dividersX < 9) {
          updateBin(bin.id, { dividersX: bin.dividersX + 1 }); return;
        }

        // Y dividers controls (right center)
        const dyCx = bx + bw + 14;
        const dyCy = by + bh / 2;
        if (Math.sqrt((mx - dyCx) ** 2 + (my - (dyCy - 16)) ** 2) <= btnR && bin.dividersY > 0) {
          updateBin(bin.id, { dividersY: bin.dividersY - 1 }); return;
        }
        if (Math.sqrt((mx - dyCx) ** 2 + (my - (dyCy + 16)) ** 2) <= btnR && bin.dividersY < 9) {
          updateBin(bin.id, { dividersY: bin.dividersY + 1 }); return;
        }
      }
    }

    // Check resize handle hit
    const handle = hitTestHandle(e.clientX, e.clientY);
    if (handle) {
      const bin = bins.find((b) => b.id === handle.binId);
      if (bin) {
        setResize({
          binId: bin.id,
          edge: handle.edge,
          origX: bin.x, origY: bin.y, origW: bin.w, origD: bin.d,
          ghostX: bin.x, ghostY: bin.y, ghostW: bin.w, ghostD: bin.d,
          startClientX: e.clientX, startClientY: e.clientY,
        });
        return;
      }
    }

    const coord = getGridCoord(e.clientX, e.clientY);
    if (!coord) return;

    // Placing mode: click to place
    if (dragState.mode === 'placing' && dragState.placingConfig) {
      const cfg = dragState.placingConfig;
      const collision = checkCollision(bins, { x: coord.col, y: coord.row, w: cfg.w, d: cfg.d }, null, gridCols, gridRows);
      if (!collision) {
        addBin({ ...cfg, x: coord.col, y: coord.row });
      }
      return;
    }

    // Check if clicking on a bin
    const clickedBin = bins.find((b) =>
      coord.col >= b.x && coord.col < b.x + b.w &&
      coord.row >= b.y && coord.row < b.y + b.d
    );

    if (clickedBin) {
      selectBin(clickedBin.id);
      // Prepare for potential drag (wait for threshold)
      mouseDownRef.current = {
        x: e.clientX,
        y: e.clientY,
        binId: clickedBin.id,
        col: clickedBin.x,
        row: clickedBin.y,
      };
    } else {
      selectBin(null);
    }
  }, [getGridCoord, bins, dragState, addBin, selectBin, updateBin, selectedBinId, pan, gridCols, gridRows, hitTestHandle, hitTestRotate]);

  // ── Mouse move ──
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Panning
    if (isPanning) {
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
      return;
    }

    // Resize in progress
    if (resize) {
      const deltaX = e.clientX - resize.startClientX;
      const deltaY = e.clientY - resize.startClientY;
      const deltaCols = Math.round(deltaX / cellSize);
      const deltaRows = Math.round(deltaY / cellSize);

      let newX = resize.origX, newY = resize.origY;
      let newW = resize.origW, newD = resize.origD;

      switch (resize.edge) {
        case 'e':
          newW = Math.max(1, resize.origW + deltaCols);
          break;
        case 'w':
          newX = resize.origX + deltaCols;
          newW = resize.origW - deltaCols;
          if (newW < 1) { newX = resize.origX + resize.origW - 1; newW = 1; }
          break;
        case 's':
          newD = Math.max(1, resize.origD + deltaRows);
          break;
        case 'n':
          newY = resize.origY + deltaRows;
          newD = resize.origD - deltaRows;
          if (newD < 1) { newY = resize.origY + resize.origD - 1; newD = 1; }
          break;
      }

      // Clamp to reasonable bounds
      newW = Math.min(newW, 10);
      newD = Math.min(newD, 10);

      setResize((prev) => prev ? {
        ...prev,
        ghostX: newX, ghostY: newY, ghostW: newW, ghostD: newD,
      } : null);
      return;
    }

    const coord = getGridCoord(e.clientX, e.clientY);
    if (coord) setHoverCell(coord);

    // Check drag threshold
    if (mouseDownRef.current && !drag) {
      const dx = e.clientX - mouseDownRef.current.x;
      const dy = e.clientY - mouseDownRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        const md = mouseDownRef.current;
        setDrag({
          binId: md.binId,
          originCol: md.col,
          originRow: md.row,
          ghostCol: md.col,
          ghostRow: md.row,
          started: true,
        });
      }
      return;
    }

    // Update drag ghost position
    if (drag && drag.started && coord) {
      const bin = bins.find((b) => b.id === drag.binId);
      if (!bin) return;
      // Offset so the bin doesn't jump — anchor at the cell that was clicked
      const clickCellInBin = {
        col: (mouseDownRef.current?.col ?? coord.col) - drag.originCol,
        row: (mouseDownRef.current?.row ?? coord.row) - drag.originRow,
      };
      setDrag((prev) => prev ? {
        ...prev,
        ghostCol: coord.col - clickCellInBin.col,
        ghostRow: coord.row - clickCellInBin.row,
      } : null);
    }
  }, [isPanning, getGridCoord, drag, bins, resize, cellSize]);

  // ── Mouse up ──
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);

    // Commit resize
    if (resize) {
      const { binId, ghostX, ghostY, ghostW, ghostD, origX, origY, origW, origD } = resize;
      const changed = ghostX !== origX || ghostY !== origY || ghostW !== origW || ghostD !== origD;
      if (changed) {
        const collision = checkCollision(
          bins,
          { x: ghostX, y: ghostY, w: ghostW, d: ghostD },
          binId,
          gridCols,
          gridRows,
        );
        if (!collision) {
          updateBin(binId, { x: ghostX, y: ghostY, w: ghostW, d: ghostD });
        }
      }
      setResize(null);
      return;
    }

    if (drag && drag.started) {
      const bin = bins.find((b) => b.id === drag.binId);
      if (bin) {
        const collision = checkCollision(
          bins,
          { x: drag.ghostCol, y: drag.ghostRow, w: bin.w, d: bin.d },
          drag.binId,
          gridCols,
          gridRows,
        );
        if (!collision && (drag.ghostCol !== drag.originCol || drag.ghostRow !== drag.originRow)) {
          moveBin(drag.binId, drag.ghostCol, drag.ghostRow);
        } else if (collision) {
          // Snap back animation
          setSnapBack({
            binId: drag.binId,
            fromCol: drag.ghostCol,
            fromRow: drag.ghostRow,
            toCol: drag.originCol,
            toRow: drag.originRow,
          });
          setTimeout(() => setSnapBack(null), 300);
        }
      }
    }

    setDrag(null);
    mouseDownRef.current = null;
  }, [drag, resize, bins, moveBin, updateBin, gridCols, gridRows]);

  // ── Mouse leave ──
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    if (drag) {
      // Cancel drag on leave
      setDrag(null);
      mouseDownRef.current = null;
    }
    if (resize) {
      setResize(null);
    }
  }, [drag, resize]);

  // ── Drop from sidebar (drag bin preset) ──
  const [dropGhost, setDropGhost] = useState<{ col: number; row: number; w: number; d: number; valid: boolean } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/gridfinity-preset')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const coord = getGridCoord(e.clientX, e.clientY);
    if (!coord) return;

    // Read preset size from global (set during dragstart in Sidebar)
    const preset = (window as any).__gridfinityDragPreset as { w: number; d: number } | undefined;
    const w = preset?.w ?? 1;
    const d = preset?.d ?? 1;
    const valid = !checkCollision(bins, { x: coord.col, y: coord.row, w, d }, null, gridCols, gridRows);
    setDropGhost({ col: coord.col, row: coord.row, w, d, valid });
  }, [getGridCoord, bins, gridCols, gridRows]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/gridfinity-preset')) return;
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropGhost(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropGhost(null);
    (window as any).__gridfinityDragPreset = null;

    const raw = e.dataTransfer.getData('application/gridfinity-preset');
    if (!raw) return;

    try {
      const preset = JSON.parse(raw);
      const coord = getGridCoord(e.clientX, e.clientY);
      if (!coord) return;

      const collision = checkCollision(
        bins,
        { x: coord.col, y: coord.row, w: preset.w, d: preset.d },
        null,
        gridCols,
        gridRows,
      );
      if (!collision) {
        addBin({
          x: coord.col, y: coord.row,
          w: preset.w, d: preset.d, h: preset.h ?? 3,
          cornerRadius: GF.BIN_CORNER_RADIUS,
          wallThickness: GF.WALL_THICKNESS,
          bottomThickness: GF.BOTTOM_THICKNESS,
          stackingLip: preset.stackingLip ?? false,
          labelShelf: preset.labelShelf ?? false,
          labelWidth: GF.LABEL_DEFAULT_WIDTH,
          magnets: preset.magnets ?? false,
          screws: preset.screws ?? false,
          dividersX: preset.dividersX ?? 0,
          dividersY: preset.dividersY ?? 0,
          color: '', label: preset.name ?? '',
          group: '',
        });
      }
    } catch { /* ignore invalid data */ }
  }, [getGridCoord, bins, addBin, gridCols, gridRows]);

  // ── Placing ghost ──
  const placingGhost = dragState.mode === 'placing' && dragState.placingConfig && hoverCell
    ? {
        col: hoverCell.col,
        row: hoverCell.row,
        w: dragState.placingConfig.w,
        d: dragState.placingConfig.d,
        valid: !checkCollision(bins, {
          x: hoverCell.col, y: hoverCell.row,
          w: dragState.placingConfig.w, d: dragState.placingConfig.d,
        }, null, gridCols, gridRows),
      }
    : null;

  // ── Drag ghost validity ──
  const dragGhostValid = drag && drag.started
    ? (() => {
        const bin = bins.find((b) => b.id === drag.binId);
        if (!bin) return false;
        return !checkCollision(
          bins,
          { x: drag.ghostCol, y: drag.ghostRow, w: bin.w, d: bin.d },
          drag.binId,
          gridCols,
          gridRows,
        );
      })()
    : false;

  // ── Resize ghost validity ──
  const resizeGhostValid = resize
    ? !checkCollision(
        bins,
        { x: resize.ghostX, y: resize.ghostY, w: resize.ghostW, d: resize.ghostD },
        resize.binId,
        gridCols,
        gridRows,
      )
    : false;

  // ── Cursor ──
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (dragState.mode === 'placing') return 'crosshair';
    if (drag?.started) return 'grabbing';
    if (resize) {
      return resize.edge === 'e' || resize.edge === 'w' ? 'ew-resize' : 'ns-resize';
    }
    return 'default';
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      style={{
        background: 'var(--bg-primary)',
        cursor: getCursor(),
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Grid background */}
        <rect
          x={pan.x}
          y={pan.y}
          width={gridW}
          height={gridH}
          fill="#0f0f18"
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* Grid lines */}
        {Array.from({ length: gridCols + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={pan.x + i * cellSize}
            y1={pan.y}
            x2={pan.x + i * cellSize}
            y2={pan.y + gridH}
            stroke="var(--border)"
            strokeWidth={0.5}
            strokeDasharray={i === 0 || i === gridCols ? undefined : '2,4'}
          />
        ))}
        {Array.from({ length: gridRows + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={pan.x}
            y1={pan.y + i * cellSize}
            x2={pan.x + gridW}
            y2={pan.y + i * cellSize}
            stroke="var(--border)"
            strokeWidth={0.5}
            strokeDasharray={i === 0 || i === gridRows ? undefined : '2,4'}
          />
        ))}

        {/* Column/Row labels */}
        {Array.from({ length: gridCols }, (_, i) => (
          <text
            key={`cl${i}`}
            x={pan.x + i * cellSize + cellSize / 2}
            y={pan.y - 6}
            textAnchor="middle"
            fontSize={10 * zoom}
            fill="var(--text-secondary)"
            fontFamily="JetBrains Mono, monospace"
          >
            {i}
          </text>
        ))}
        {Array.from({ length: gridRows }, (_, i) => (
          <text
            key={`rl${i}`}
            x={pan.x - 6}
            y={pan.y + i * cellSize + cellSize / 2 + 3}
            textAnchor="end"
            fontSize={10 * zoom}
            fill="var(--text-secondary)"
            fontFamily="JetBrains Mono, monospace"
          >
            {i}
          </text>
        ))}

        {/* ── Bins ── */}
        {bins.map((bin) => {
          const isDragging = drag?.started && drag.binId === bin.id;
          const isSnapping = snapBack?.binId === bin.id;
          const isResizing = resize?.binId === bin.id;

          // During drag: show bin at ghost position
          if (isDragging) {
            return (
              <g key={bin.id}>
                {/* Original position: dotted outline */}
                <rect
                  x={pan.x + bin.x * cellSize + 2}
                  y={pan.y + bin.y * cellSize + 2}
                  width={bin.w * cellSize - 4}
                  height={bin.d * cellSize - 4}
                  rx={4}
                  fill="none"
                  stroke={bin.color}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity={0.4}
                />

                {/* Ghost at cursor position */}
                <rect
                  x={pan.x + drag.ghostCol * cellSize + 2}
                  y={pan.y + drag.ghostRow * cellSize + 2}
                  width={bin.w * cellSize - 4}
                  height={bin.d * cellSize - 4}
                  rx={4}
                  fill={dragGhostValid ? '#00d4aa22' : '#ff446622'}
                  stroke={dragGhostValid ? 'var(--accent)' : 'var(--danger)'}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  pointerEvents="none"
                />

                {/* Dragged bin (semi-transparent, follows ghost) */}
                <rect
                  x={pan.x + drag.ghostCol * cellSize + 2}
                  y={pan.y + drag.ghostRow * cellSize + 2}
                  width={bin.w * cellSize - 4}
                  height={bin.d * cellSize - 4}
                  rx={4}
                  fill={bin.color + '66'}
                  stroke={bin.color}
                  strokeWidth={1.5}
                  opacity={0.7}
                  pointerEvents="none"
                />
                <text
                  x={pan.x + drag.ghostCol * cellSize + (bin.w * cellSize) / 2}
                  y={pan.y + drag.ghostRow * cellSize + (bin.d * cellSize) / 2 + 4}
                  textAnchor="middle"
                  fontSize={Math.min(11 * zoom, 14)}
                  fill={bin.color}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="bold"
                  opacity={0.7}
                  pointerEvents="none"
                >
                  {bin.label || `${bin.w}x${bin.d}`}
                </text>
              </g>
            );
          }

          // During resize: show ghost at new dimensions
          if (isResizing && resize) {
            return (
              <g key={bin.id}>
                {/* Original position: dotted outline */}
                <rect
                  x={pan.x + resize.origX * cellSize + 2}
                  y={pan.y + resize.origY * cellSize + 2}
                  width={resize.origW * cellSize - 4}
                  height={resize.origD * cellSize - 4}
                  rx={4}
                  fill="none"
                  stroke={bin.color}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity={0.4}
                />

                {/* Ghost at new size */}
                <rect
                  x={pan.x + resize.ghostX * cellSize + 2}
                  y={pan.y + resize.ghostY * cellSize + 2}
                  width={resize.ghostW * cellSize - 4}
                  height={resize.ghostD * cellSize - 4}
                  rx={4}
                  fill={resizeGhostValid ? '#00d4aa22' : '#ff446622'}
                  stroke={resizeGhostValid ? 'var(--accent)' : 'var(--danger)'}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  pointerEvents="none"
                />

                {/* Resized bin preview */}
                <rect
                  x={pan.x + resize.ghostX * cellSize + 2}
                  y={pan.y + resize.ghostY * cellSize + 2}
                  width={resize.ghostW * cellSize - 4}
                  height={resize.ghostD * cellSize - 4}
                  rx={4}
                  fill={bin.color + '66'}
                  stroke={bin.color}
                  strokeWidth={1.5}
                  opacity={0.7}
                  pointerEvents="none"
                />
                <text
                  x={pan.x + resize.ghostX * cellSize + (resize.ghostW * cellSize) / 2}
                  y={pan.y + resize.ghostY * cellSize + (resize.ghostD * cellSize) / 2 + 4}
                  textAnchor="middle"
                  fontSize={Math.min(11 * zoom, 14)}
                  fill={resizeGhostValid ? 'var(--accent)' : 'var(--danger)'}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="bold"
                  opacity={0.8}
                  pointerEvents="none"
                >
                  {resize.ghostW}x{resize.ghostD}
                </text>
              </g>
            );
          }

          // Snap-back animation
          const animX = isSnapping ? snapBack.fromCol : bin.x;
          const animY = isSnapping ? snapBack.fromRow : bin.y;

          return (
            <g key={bin.id}>
              <rect
                x={pan.x + animX * cellSize + 2}
                y={pan.y + animY * cellSize + 2}
                width={bin.w * cellSize - 4}
                height={bin.d * cellSize - 4}
                rx={4}
                fill={bin.color + '44'}
                stroke={selectedBinId === bin.id ? 'var(--accent)' : bin.color}
                strokeWidth={selectedBinId === bin.id ? 2 : 1}
                style={isSnapping ? {
                  transition: 'x 0.3s ease-out, y 0.3s ease-out',
                  x: pan.x + snapBack.toCol * cellSize + 2,
                  y: pan.y + snapBack.toRow * cellSize + 2,
                } : undefined}
              />
              {/* Selection glow (pulsing) */}
              {selectedBinId === bin.id && !isSnapping && (
                <rect
                  x={pan.x + bin.x * cellSize}
                  y={pan.y + bin.y * cellSize}
                  width={bin.w * cellSize}
                  height={bin.d * cellSize}
                  rx={6}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1}
                  className="animate-glow-pulse"
                  filter="url(#glow)"
                  pointerEvents="none"
                />
              )}
              {/* ── Interior divider lines ── */}
              {(bin.dividersX > 0 || bin.dividersY > 0) && !isSnapping && (() => {
                const bx2 = pan.x + bin.x * cellSize + 2;
                const by2 = pan.y + bin.y * cellSize + 2;
                const bw2 = bin.w * cellSize - 4;
                const bh2 = bin.d * cellSize - 4;
                const isSelected = selectedBinId === bin.id;
                return (
                  <g pointerEvents="none">
                    {/* X dividers (vertical lines) */}
                    {Array.from({ length: bin.dividersX }, (_, i) => {
                      const lx = bx2 + ((i + 1) / (bin.dividersX + 1)) * bw2;
                      return (
                        <line key={`dx${i}`}
                          x1={lx} y1={by2 + 2} x2={lx} y2={by2 + bh2 - 2}
                          stroke={isSelected ? 'var(--accent)' : bin.color}
                          strokeWidth={1} opacity={isSelected ? 0.5 : 0.3}
                          strokeDasharray="3,3"
                        />
                      );
                    })}
                    {/* Y dividers (horizontal lines) */}
                    {Array.from({ length: bin.dividersY }, (_, i) => {
                      const ly = by2 + ((i + 1) / (bin.dividersY + 1)) * bh2;
                      return (
                        <line key={`dy${i}`}
                          x1={bx2 + 2} y1={ly} x2={bx2 + bw2 - 2} y2={ly}
                          stroke={isSelected ? 'var(--accent)' : bin.color}
                          strokeWidth={1} opacity={isSelected ? 0.5 : 0.3}
                          strokeDasharray="3,3"
                        />
                      );
                    })}
                  </g>
                );
              })()}

              <text
                x={pan.x + (isSnapping ? snapBack.toCol : bin.x) * cellSize + (bin.w * cellSize) / 2}
                y={pan.y + (isSnapping ? snapBack.toRow : bin.y) * cellSize + (bin.d * cellSize) / 2 + 4}
                textAnchor="middle"
                fontSize={Math.min(11 * zoom, 14)}
                fill={bin.color}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
              >
                {bin.label || `${bin.w}x${bin.d}`}
              </text>
              {/* Group color indicator (small dot top-left) */}
              {bin.group && (() => {
                const grp = BIN_GROUPS.find((g) => g.id === bin.group);
                if (!grp) return null;
                const bx2 = pan.x + (isSnapping ? (snapBack?.toCol ?? bin.x) : bin.x) * cellSize;
                const by2 = pan.y + (isSnapping ? (snapBack?.toRow ?? bin.y) : bin.y) * cellSize;
                const dotR = Math.max(3, 4 * zoom);
                return (
                  <circle
                    cx={bx2 + 8} cy={by2 + 8}
                    r={dotR}
                    fill={grp.color}
                    stroke="var(--bg-primary)" strokeWidth={1}
                    pointerEvents="none"
                  />
                );
              })()}

              {/* ── Divider controls (on selected bin) ── */}
              {selectedBinId === bin.id && !isSnapping && !drag && !resize && dragState.mode === 'idle' && (() => {
                const bx2 = pan.x + bin.x * cellSize;
                const by2 = pan.y + bin.y * cellSize;
                const bw2 = bin.w * cellSize;
                const bh2 = bin.d * cellSize;
                const btnR = 9;
                const show = bw2 > 50 && bh2 > 50; // only show if bin is large enough on screen
                if (!show) return null;

                // X dividers control: bottom edge, center
                const dxCx = bx2 + bw2 / 2;
                const dxCy = by2 + bh2 + 14;
                // Y dividers control: right edge, center
                const dyCx = bx2 + bw2 + 14;
                const dyCy = by2 + bh2 / 2;

                return (
                  <g>
                    {/* X dividers: - and + */}
                    <g data-action="divX-dec">
                      <circle cx={dxCx - 16} cy={dxCy} r={btnR}
                        fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth={1}
                        style={{ cursor: bin.dividersX > 0 ? 'pointer' : 'default' }}
                        opacity={bin.dividersX > 0 ? 1 : 0.3}
                      />
                      <text x={dxCx - 16} y={dxCy + 1} textAnchor="middle" dominantBaseline="middle"
                        fontSize={12} fontWeight="bold" fill="var(--text-secondary)" pointerEvents="none"
                      >-</text>
                    </g>
                    <text x={dxCx} y={dxCy + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={9} fill="var(--text-secondary)" fontFamily="JetBrains Mono, monospace" pointerEvents="none"
                    >X:{bin.dividersX}</text>
                    <g data-action="divX-inc">
                      <circle cx={dxCx + 16} cy={dxCy} r={btnR}
                        fill="var(--bg-secondary)" stroke="var(--accent)" strokeWidth={1}
                        style={{ cursor: bin.dividersX < 9 ? 'pointer' : 'default' }}
                        opacity={bin.dividersX < 9 ? 1 : 0.3}
                      />
                      <text x={dxCx + 16} y={dxCy + 1} textAnchor="middle" dominantBaseline="middle"
                        fontSize={12} fontWeight="bold" fill="var(--accent)" pointerEvents="none"
                      >+</text>
                    </g>

                    {/* Y dividers: - and + */}
                    <g data-action="divY-dec">
                      <circle cx={dyCx} cy={dyCy - 16} r={btnR}
                        fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth={1}
                        style={{ cursor: bin.dividersY > 0 ? 'pointer' : 'default' }}
                        opacity={bin.dividersY > 0 ? 1 : 0.3}
                      />
                      <text x={dyCx} y={dyCy - 15} textAnchor="middle" dominantBaseline="middle"
                        fontSize={12} fontWeight="bold" fill="var(--text-secondary)" pointerEvents="none"
                      >-</text>
                    </g>
                    <text x={dyCx} y={dyCy + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={9} fill="var(--text-secondary)" fontFamily="JetBrains Mono, monospace" pointerEvents="none"
                    >Y:{bin.dividersY}</text>
                    <g data-action="divY-inc">
                      <circle cx={dyCx} cy={dyCy + 16} r={btnR}
                        fill="var(--bg-secondary)" stroke="var(--accent)" strokeWidth={1}
                        style={{ cursor: bin.dividersY < 9 ? 'pointer' : 'default' }}
                        opacity={bin.dividersY < 9 ? 1 : 0.3}
                      />
                      <text x={dyCx} y={dyCy + 17} textAnchor="middle" dominantBaseline="middle"
                        fontSize={12} fontWeight="bold" fill="var(--accent)" pointerEvents="none"
                      >+</text>
                    </g>
                  </g>
                );
              })()}

              {/* ── Resize handles (only on selected bin, not during drag/place) ── */}
              {selectedBinId === bin.id && !isSnapping && !drag && !resize && dragState.mode === 'idle' && (() => {
                const bx = pan.x + bin.x * cellSize;
                const by = pan.y + bin.y * cellSize;
                const bw = bin.w * cellSize;
                const bh = bin.d * cellSize;
                const hl = Math.min(HANDLE_LENGTH * zoom, bw * 0.4, bh * 0.4);
                const hs = HANDLE_SIZE;

                return (
                  <g>
                    {/* East handle (right edge center) */}
                    <rect
                      x={bx + bw - hs / 2}
                      y={by + bh / 2 - hl / 2}
                      width={hs}
                      height={hl}
                      rx={hs / 2}
                      fill="var(--accent)"
                      stroke="var(--bg-primary)"
                      strokeWidth={1}
                      style={{ cursor: 'ew-resize' }}
                      opacity={0.9}
                    />
                    {/* West handle (left edge center) */}
                    <rect
                      x={bx - hs / 2}
                      y={by + bh / 2 - hl / 2}
                      width={hs}
                      height={hl}
                      rx={hs / 2}
                      fill="var(--accent)"
                      stroke="var(--bg-primary)"
                      strokeWidth={1}
                      style={{ cursor: 'ew-resize' }}
                      opacity={0.9}
                    />
                    {/* South handle (bottom edge center) */}
                    <rect
                      x={bx + bw / 2 - hl / 2}
                      y={by + bh - hs / 2}
                      width={hl}
                      height={hs}
                      rx={hs / 2}
                      fill="var(--accent)"
                      stroke="var(--bg-primary)"
                      strokeWidth={1}
                      style={{ cursor: 'ns-resize' }}
                      opacity={0.9}
                    />
                    {/* North handle (top edge center) */}
                    <rect
                      x={bx + bw / 2 - hl / 2}
                      y={by - hs / 2}
                      width={hl}
                      height={hs}
                      rx={hs / 2}
                      fill="var(--accent)"
                      stroke="var(--bg-primary)"
                      strokeWidth={1}
                      style={{ cursor: 'ns-resize' }}
                      opacity={0.9}
                    />
                    {/* Rotate handle (top-right corner) */}
                    {bin.w !== bin.d && (
                      <g style={{ cursor: 'pointer' }}>
                        <circle
                          cx={bx + bw + 2}
                          cy={by - 2}
                          r={10}
                          fill="var(--bg-secondary)"
                          stroke="var(--accent)"
                          strokeWidth={1.5}
                        />
                        {/* Rotate arrow icon */}
                        <path
                          d={`M${bx + bw - 1.5} ${by - 5.5} A 4.5 4.5 0 1 1 ${bx + bw + 5.5} ${by - 5.5}`}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        />
                        <path
                          d={`M${bx + bw + 5.5} ${by - 8} L${bx + bw + 5.5} ${by - 5.5} L${bx + bw + 3} ${by - 5.5}`}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Placing ghost */}
        {placingGhost && (
          <g pointerEvents="none">
            <rect
              x={pan.x + placingGhost.col * cellSize + 2}
              y={pan.y + placingGhost.row * cellSize + 2}
              width={placingGhost.w * cellSize - 4}
              height={placingGhost.d * cellSize - 4}
              rx={4}
              fill={placingGhost.valid ? '#00d4aa22' : '#ff446622'}
              stroke={placingGhost.valid ? 'var(--accent)' : 'var(--danger)'}
              strokeWidth={2}
              strokeDasharray="4,4"
            />
            {/* Size label on ghost */}
            <text
              x={pan.x + placingGhost.col * cellSize + (placingGhost.w * cellSize) / 2}
              y={pan.y + placingGhost.row * cellSize + (placingGhost.d * cellSize) / 2 + 4}
              textAnchor="middle"
              fontSize={Math.min(11 * zoom, 14)}
              fill={placingGhost.valid ? 'var(--accent)' : 'var(--danger)'}
              fontFamily="JetBrains Mono, monospace"
              fontWeight="bold"
              opacity={0.6}
            >
              {placingGhost.w}x{placingGhost.d}
            </text>
          </g>
        )}

        {/* Drop ghost (from sidebar drag) */}
        {dropGhost && (
          <g pointerEvents="none">
            <rect
              x={pan.x + dropGhost.col * cellSize + 2}
              y={pan.y + dropGhost.row * cellSize + 2}
              width={dropGhost.w * cellSize - 4}
              height={dropGhost.d * cellSize - 4}
              rx={4}
              fill={dropGhost.valid ? '#00d4aa22' : '#ff446622'}
              stroke={dropGhost.valid ? 'var(--accent)' : 'var(--danger)'}
              strokeWidth={2}
              strokeDasharray="4,4"
            />
          </g>
        )}

        {/* Hover cell highlight (only in idle, not dragging, placing, or resizing) */}
        {hoverCell && !placingGhost && !drag && !resize &&
          hoverCell.col >= 0 && hoverCell.col < gridCols &&
          hoverCell.row >= 0 && hoverCell.row < gridRows && (
          <rect
            x={pan.x + hoverCell.col * cellSize}
            y={pan.y + hoverCell.row * cellSize}
            width={cellSize}
            height={cellSize}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={0.5}
            pointerEvents="none"
          />
        )}

        {/* ── Measurement overlay ── */}
        {/* Grid total dimensions (always visible) */}
        {(() => {
          const totalWmm = gridCols * GF.CELL_SIZE;
          const totalDmm = gridRows * GF.CELL_SIZE;
          const arrowOff = 20;
          const gx = pan.x;
          const gy = pan.y;

          return (
            <g pointerEvents="none" opacity={0.5}>
              {/* Top dimension line (width) */}
              <line x1={gx} y1={gy - arrowOff} x2={gx + gridW} y2={gy - arrowOff}
                stroke="var(--accent)" strokeWidth={0.8} />
              <line x1={gx} y1={gy - arrowOff - 4} x2={gx} y2={gy - arrowOff + 4}
                stroke="var(--accent)" strokeWidth={0.8} />
              <line x1={gx + gridW} y1={gy - arrowOff - 4} x2={gx + gridW} y2={gy - arrowOff + 4}
                stroke="var(--accent)" strokeWidth={0.8} />
              <text x={gx + gridW / 2} y={gy - arrowOff - 5}
                textAnchor="middle" fontSize={9 * Math.min(zoom, 1.5)} fill="var(--accent)"
                fontFamily="JetBrains Mono, monospace"
              >
                {totalWmm} mm
              </text>

              {/* Left dimension line (depth) */}
              <line x1={gx - arrowOff} y1={gy} x2={gx - arrowOff} y2={gy + gridH}
                stroke="var(--accent)" strokeWidth={0.8} />
              <line x1={gx - arrowOff - 4} y1={gy} x2={gx - arrowOff + 4} y2={gy}
                stroke="var(--accent)" strokeWidth={0.8} />
              <line x1={gx - arrowOff - 4} y1={gy + gridH} x2={gx - arrowOff + 4} y2={gy + gridH}
                stroke="var(--accent)" strokeWidth={0.8} />
              <text x={gx - arrowOff - 5} y={gy + gridH / 2}
                textAnchor="middle" fontSize={9 * Math.min(zoom, 1.5)} fill="var(--accent)"
                fontFamily="JetBrains Mono, monospace"
                transform={`rotate(-90, ${gx - arrowOff - 5}, ${gy + gridH / 2})`}
              >
                {totalDmm} mm
              </text>
            </g>
          );
        })()}

        {/* Bin dimension on hover (show mm when hovering over a bin) */}
        {hoverCell && !drag && !resize && dragState.mode === 'idle' && (() => {
          const hoveredBin = bins.find((b) =>
            hoverCell.col >= b.x && hoverCell.col < b.x + b.w &&
            hoverCell.row >= b.y && hoverCell.row < b.y + b.d
          );
          if (!hoveredBin || hoveredBin.id === selectedBinId) return null;

          const bx = pan.x + hoveredBin.x * cellSize;
          const by = pan.y + hoveredBin.y * cellSize;
          const bw = hoveredBin.w * cellSize;
          const bh = hoveredBin.d * cellSize;
          const wMM = (hoveredBin.w * GF.CELL_SIZE - GF.TOLERANCE).toFixed(1);
          const dMM = (hoveredBin.d * GF.CELL_SIZE - GF.TOLERANCE).toFixed(1);
          const hMM = (hoveredBin.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT).toFixed(1);

          return (
            <g pointerEvents="none">
              {/* Width dimension (bottom of bin) */}
              <line x1={bx + 2} y1={by + bh + 10} x2={bx + bw - 2} y2={by + bh + 10}
                stroke="#60a5fa" strokeWidth={0.8} />
              <line x1={bx + 2} y1={by + bh + 6} x2={bx + 2} y2={by + bh + 14}
                stroke="#60a5fa" strokeWidth={0.8} />
              <line x1={bx + bw - 2} y1={by + bh + 6} x2={bx + bw - 2} y2={by + bh + 14}
                stroke="#60a5fa" strokeWidth={0.8} />
              <text x={bx + bw / 2} y={by + bh + 22}
                textAnchor="middle" fontSize={9 * Math.min(zoom, 1.3)} fill="#60a5fa"
                fontFamily="JetBrains Mono, monospace"
              >
                {wMM}mm
              </text>

              {/* Depth dimension (right of bin) */}
              <line x1={bx + bw + 10} y1={by + 2} x2={bx + bw + 10} y2={by + bh - 2}
                stroke="#60a5fa" strokeWidth={0.8} />
              <line x1={bx + bw + 6} y1={by + 2} x2={bx + bw + 14} y2={by + 2}
                stroke="#60a5fa" strokeWidth={0.8} />
              <line x1={bx + bw + 6} y1={by + bh - 2} x2={bx + bw + 14} y2={by + bh - 2}
                stroke="#60a5fa" strokeWidth={0.8} />
              <text x={bx + bw + 22} y={by + bh / 2}
                textAnchor="middle" fontSize={9 * Math.min(zoom, 1.3)} fill="#60a5fa"
                fontFamily="JetBrains Mono, monospace"
                transform={`rotate(-90, ${bx + bw + 22}, ${by + bh / 2})`}
              >
                {dMM}mm
              </text>

              {/* Height badge (top-right) */}
              <rect x={bx + bw - 36} y={by - 16} width={34} height={14} rx={3}
                fill="rgba(96, 165, 250, 0.15)" stroke="#60a5fa" strokeWidth={0.5} />
              <text x={bx + bw - 19} y={by - 7}
                textAnchor="middle" fontSize={8 * Math.min(zoom, 1.3)} fill="#60a5fa"
                fontFamily="JetBrains Mono, monospace"
              >
                h:{hMM}
              </text>
            </g>
          );
        })()}

        {/* Selected bin dimensions (always show mm for selected bin) */}
        {selectedBinId && !drag && !resize && (() => {
          const bin = bins.find((b) => b.id === selectedBinId);
          if (!bin) return null;

          const bx = pan.x + bin.x * cellSize;
          const by = pan.y + bin.y * cellSize;
          const bw = bin.w * cellSize;
          const bh = bin.d * cellSize;
          const wMM = (bin.w * GF.CELL_SIZE - GF.TOLERANCE).toFixed(1);
          const dMM = (bin.d * GF.CELL_SIZE - GF.TOLERANCE).toFixed(1);
          const hMM = (bin.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT).toFixed(1);

          return (
            <g pointerEvents="none">
              {/* Width dimension (bottom) */}
              <line x1={bx + 2} y1={by + bh + 10} x2={bx + bw - 2} y2={by + bh + 10}
                stroke="var(--accent)" strokeWidth={1} />
              <line x1={bx + 2} y1={by + bh + 6} x2={bx + 2} y2={by + bh + 14}
                stroke="var(--accent)" strokeWidth={1} />
              <line x1={bx + bw - 2} y1={by + bh + 6} x2={bx + bw - 2} y2={by + bh + 14}
                stroke="var(--accent)" strokeWidth={1} />
              <text x={bx + bw / 2} y={by + bh + 22}
                textAnchor="middle" fontSize={10 * Math.min(zoom, 1.3)} fill="var(--accent)"
                fontFamily="JetBrains Mono, monospace" fontWeight="bold"
              >
                {wMM} mm
              </text>

              {/* Depth dimension (right) */}
              <line x1={bx + bw + 10} y1={by + 2} x2={bx + bw + 10} y2={by + bh - 2}
                stroke="var(--accent)" strokeWidth={1} />
              <line x1={bx + bw + 6} y1={by + 2} x2={bx + bw + 14} y2={by + 2}
                stroke="var(--accent)" strokeWidth={1} />
              <line x1={bx + bw + 6} y1={by + bh - 2} x2={bx + bw + 14} y2={by + bh - 2}
                stroke="var(--accent)" strokeWidth={1} />
              <text x={bx + bw + 22} y={by + bh / 2}
                textAnchor="middle" fontSize={10 * Math.min(zoom, 1.3)} fill="var(--accent)"
                fontFamily="JetBrains Mono, monospace" fontWeight="bold"
                transform={`rotate(-90, ${bx + bw + 22}, ${by + bh / 2})`}
              >
                {dMM} mm
              </text>

              {/* Height badge */}
              <rect x={bx + bw - 44} y={by - 18} width={42} height={16} rx={3}
                fill="rgba(0, 212, 170, 0.15)" stroke="var(--accent)" strokeWidth={0.8} />
              <text x={bx + bw - 23} y={by - 8}
                textAnchor="middle" fontSize={9 * Math.min(zoom, 1.3)} fill="var(--accent)"
                fontFamily="JetBrains Mono, monospace" fontWeight="bold"
              >
                h:{hMM}mm
              </text>
            </g>
          );
        })()}

        {/* SVG filter for selection glow */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Zoom indicator */}
      <div
        className="absolute bottom-3 right-3 text-[10px] px-2 py-1 rounded"
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
      >
        {(zoom * 100).toFixed(0)}%
      </div>

      {/* Keyboard hint during placing mode */}
      {dragState.mode === 'placing' && (
        <div
          className="absolute bottom-3 left-3 text-[10px] px-2 py-1 rounded"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          Click to place | R to rotate | Esc to cancel
        </div>
      )}
    </div>
  );
}
