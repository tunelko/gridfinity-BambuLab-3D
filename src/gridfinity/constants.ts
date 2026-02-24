export const GF = {
  CELL_SIZE: 42,
  HEIGHT_UNIT: 7,
  TOLERANCE: 0.5,

  BIN_CORNER_RADIUS: 3.75,
  BASE_CORNER_RADIUS: 4.0,

  BASE_TOTAL_HEIGHT: 4.75,

  WALL_THICKNESS: 1.2,
  BOTTOM_THICKNESS: 0.8,

  STACKING_LIP_HEIGHT: 4.4,

  MAGNET_DIAMETER: 6,
  MAGNET_DEPTH: 2,
  MAGNET_INSET: 4.8,

  SCREW_DIAMETER: 3,
  SCREW_HOLE_DIAMETER: 3.2,

  LABEL_ANGLE: 45,
  LABEL_DEFAULT_WIDTH: 12,

  BASEPLATE_HEIGHT: 6.4,

  INTER_CELL_GAP: 0.5,
} as const;

export const GRID_PRESETS: { name: string; cols: number; rows: number; default?: boolean }[] = [
  { name: 'A1',        cols: 6, rows: 6, default: true }, // 256×256mm → 252×252mm
  { name: 'A1 Mini',   cols: 4, rows: 4 },                // 180×180mm → 168×168mm
  { name: 'P1S',       cols: 6, rows: 6 },                // 256×256mm
  { name: 'X1C',       cols: 6, rows: 6 },                // 256×256mm
  { name: 'X1E',       cols: 6, rows: 6 },                // 256×256mm
  { name: 'H2D',       cols: 6, rows: 6 },                // 256×256mm
  { name: '19" Rack',  cols: 10, rows: 8 },              // ~420×336mm (rack tray)
  { name: 'Custom',    cols: 8, rows: 8 },
];

export const BIN_PRESETS = [
  { name: 'Small Parts',  w: 1, d: 1, h: 3, stackingLip: true,  labelShelf: false, magnets: false, screws: false, dividersX: 0, dividersY: 0 },
  { name: 'Screwdriver',  w: 1, d: 4, h: 6, stackingLip: false, labelShelf: false, magnets: false, screws: false, dividersX: 0, dividersY: 0 },
  { name: 'Socket Tray',  w: 2, d: 2, h: 2, stackingLip: false, labelShelf: false, magnets: false, screws: false, dividersX: 3, dividersY: 3 },
  { name: 'Deep Bin',     w: 2, d: 2, h: 6, stackingLip: true,  labelShelf: true,  magnets: false, screws: false, dividersX: 0, dividersY: 0 },
  { name: 'Wide Shallow', w: 3, d: 2, h: 2, stackingLip: true,  labelShelf: false, magnets: false, screws: false, dividersX: 0, dividersY: 0 },
  { name: 'SFP Tray',    w: 2, d: 1, h: 2, stackingLip: false, labelShelf: false, magnets: false, screws: false, dividersX: 5, dividersY: 0 },
  { name: 'Cable Mgmt',  w: 1, d: 6, h: 3, stackingLip: false, labelShelf: false, magnets: false, screws: false, dividersX: 0, dividersY: 0 },
];
