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

// ── Bin Groups / Tags ──

export const BIN_GROUPS: { id: string; label: string; color: string }[] = [
  { id: '',            label: 'None',        color: '' },
  { id: 'screws',      label: 'Screws',      color: '#4488ff' },
  { id: 'tools',       label: 'Tools',       color: '#ff6644' },
  { id: 'cables',      label: 'Cables',      color: '#ffaa00' },
  { id: 'electronics', label: 'Electronics', color: '#aa44ff' },
  { id: 'parts',       label: 'Parts',       color: '#00d4aa' },
  { id: 'office',      label: 'Office',      color: '#ff44aa' },
  { id: 'network',     label: 'Network',     color: '#44ddff' },
];

// ── Layout Templates ──

export interface LayoutTemplate {
  name: string;
  description: string;
  gridCols: number;
  gridRows: number;
  bins: { x: number; y: number; w: number; d: number; h: number; label: string; group: string; dividersX: number; dividersY: number }[];
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    name: 'IKEA Alex Drawer',
    description: '7x14 grid for IKEA ALEX desk drawer',
    gridCols: 7, gridRows: 14,
    bins: [
      { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Pens', group: 'office', dividersX: 0, dividersY: 0 },
      { x: 2, y: 0, w: 2, d: 2, h: 3, label: 'Clips', group: 'office', dividersX: 2, dividersY: 2 },
      { x: 4, y: 0, w: 3, d: 2, h: 3, label: 'Notes', group: 'office', dividersX: 0, dividersY: 0 },
      { x: 0, y: 2, w: 1, d: 1, h: 3, label: 'USB', group: 'cables', dividersX: 0, dividersY: 0 },
      { x: 1, y: 2, w: 1, d: 1, h: 3, label: 'SD Cards', group: 'electronics', dividersX: 0, dividersY: 0 },
      { x: 2, y: 2, w: 5, d: 3, h: 3, label: 'Notebooks', group: 'office', dividersX: 0, dividersY: 0 },
      { x: 0, y: 3, w: 2, d: 4, h: 3, label: 'Cables', group: 'cables', dividersX: 0, dividersY: 0 },
      { x: 2, y: 5, w: 5, d: 2, h: 3, label: 'Misc', group: 'parts', dividersX: 3, dividersY: 0 },
    ],
  },
  {
    name: 'Electronics Bench',
    description: '6x6 grid for electronics workspace',
    gridCols: 6, gridRows: 6,
    bins: [
      { x: 0, y: 0, w: 1, d: 1, h: 3, label: 'Resistors', group: 'electronics', dividersX: 0, dividersY: 0 },
      { x: 1, y: 0, w: 1, d: 1, h: 3, label: 'Capacitors', group: 'electronics', dividersX: 0, dividersY: 0 },
      { x: 2, y: 0, w: 1, d: 1, h: 3, label: 'LEDs', group: 'electronics', dividersX: 0, dividersY: 0 },
      { x: 3, y: 0, w: 1, d: 1, h: 3, label: 'ICs', group: 'electronics', dividersX: 0, dividersY: 0 },
      { x: 4, y: 0, w: 2, d: 2, h: 3, label: 'Arduino', group: 'electronics', dividersX: 0, dividersY: 0 },
      { x: 0, y: 1, w: 2, d: 2, h: 6, label: 'Soldering', group: 'tools', dividersX: 0, dividersY: 0 },
      { x: 2, y: 1, w: 2, d: 1, h: 2, label: 'Connectors', group: 'electronics', dividersX: 3, dividersY: 0 },
      { x: 0, y: 3, w: 3, d: 3, h: 2, label: 'Wire Spools', group: 'cables', dividersX: 2, dividersY: 2 },
      { x: 3, y: 3, w: 1, d: 3, h: 6, label: 'Screwdrivers', group: 'tools', dividersX: 0, dividersY: 0 },
      { x: 4, y: 2, w: 2, d: 2, h: 3, label: 'Multimeter', group: 'tools', dividersX: 0, dividersY: 0 },
      { x: 4, y: 4, w: 2, d: 2, h: 2, label: 'Tape & Glue', group: 'tools', dividersX: 1, dividersY: 0 },
    ],
  },
  {
    name: 'Tool Wall',
    description: '8x4 grid for workshop tool organizer',
    gridCols: 8, gridRows: 4,
    bins: [
      { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Drill Bits', group: 'tools', dividersX: 3, dividersY: 0 },
      { x: 2, y: 0, w: 1, d: 4, h: 6, label: 'Screwdriver', group: 'tools', dividersX: 0, dividersY: 0 },
      { x: 3, y: 0, w: 1, d: 4, h: 6, label: 'Allen Keys', group: 'tools', dividersX: 0, dividersY: 0 },
      { x: 4, y: 0, w: 2, d: 2, h: 3, label: 'M3 Screws', group: 'screws', dividersX: 1, dividersY: 1 },
      { x: 6, y: 0, w: 2, d: 2, h: 3, label: 'M5 Screws', group: 'screws', dividersX: 1, dividersY: 1 },
      { x: 0, y: 2, w: 2, d: 2, h: 3, label: 'Nuts & Bolts', group: 'screws', dividersX: 2, dividersY: 2 },
      { x: 4, y: 2, w: 2, d: 2, h: 3, label: 'Washers', group: 'screws', dividersX: 1, dividersY: 1 },
      { x: 6, y: 2, w: 2, d: 2, h: 2, label: 'Zip Ties', group: 'cables', dividersX: 0, dividersY: 0 },
    ],
  },
  {
    name: 'Server Rack 1U',
    description: '10x8 grid for 19" rack tray organizer',
    gridCols: 10, gridRows: 8,
    bins: [
      { x: 0, y: 0, w: 2, d: 1, h: 2, label: 'SFP Modules', group: 'network', dividersX: 5, dividersY: 0 },
      { x: 2, y: 0, w: 2, d: 1, h: 2, label: 'SFP Modules', group: 'network', dividersX: 5, dividersY: 0 },
      { x: 4, y: 0, w: 2, d: 2, h: 3, label: 'RJ45 Plugs', group: 'network', dividersX: 2, dividersY: 2 },
      { x: 6, y: 0, w: 2, d: 2, h: 3, label: 'Keystones', group: 'network', dividersX: 1, dividersY: 1 },
      { x: 8, y: 0, w: 2, d: 4, h: 6, label: 'Patch Cables', group: 'cables', dividersX: 0, dividersY: 0 },
      { x: 0, y: 1, w: 4, d: 3, h: 2, label: 'SSDs 2.5"', group: 'electronics', dividersX: 3, dividersY: 2 },
      { x: 4, y: 2, w: 4, d: 2, h: 3, label: 'Drive Caddies', group: 'parts', dividersX: 3, dividersY: 0 },
      { x: 0, y: 4, w: 2, d: 2, h: 3, label: 'M5 Cage Nuts', group: 'screws', dividersX: 1, dividersY: 1 },
      { x: 2, y: 4, w: 2, d: 2, h: 3, label: 'M6 Bolts', group: 'screws', dividersX: 1, dividersY: 1 },
      { x: 4, y: 4, w: 2, d: 2, h: 2, label: 'USB Dongles', group: 'electronics', dividersX: 3, dividersY: 0 },
      { x: 6, y: 4, w: 2, d: 2, h: 2, label: 'Labels', group: 'office', dividersX: 0, dividersY: 0 },
      { x: 0, y: 6, w: 3, d: 2, h: 2, label: 'Velcro Straps', group: 'cables', dividersX: 0, dividersY: 0 },
      { x: 3, y: 6, w: 3, d: 2, h: 2, label: 'Cable Ties', group: 'cables', dividersX: 0, dividersY: 0 },
      { x: 6, y: 6, w: 4, d: 2, h: 3, label: 'Misc Tools', group: 'tools', dividersX: 2, dividersY: 0 },
    ],
  },
];
