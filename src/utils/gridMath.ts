export const CELL_PX = 64;

export interface GridCoord {
  col: number;
  row: number;
}

export interface ScreenCoord {
  x: number;
  y: number;
}

export function screenToGrid(
  screen: ScreenCoord,
  pan: ScreenCoord,
  zoom: number,
): GridCoord {
  return {
    col: Math.floor((screen.x - pan.x) / (CELL_PX * zoom)),
    row: Math.floor((screen.y - pan.y) / (CELL_PX * zoom)),
  };
}

export function gridToScreen(
  grid: GridCoord,
  pan: ScreenCoord,
  zoom: number,
): ScreenCoord {
  return {
    x: grid.col * CELL_PX * zoom + pan.x,
    y: grid.row * CELL_PX * zoom + pan.y,
  };
}
