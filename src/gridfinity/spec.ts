// Official Gridfinity specification values — single source of truth.
// Reference: https://gridfinity.xyz/specification/ (Zack Freedman's original
// spec; cross-checked against gridfinity-rebuilt-openscad standards).
//
// All chamfers are 45°. "Inset" = horizontal distance from the 41.5mm cell
// boundary, per side.

export const SPEC = {
  /** Grid pitch. */
  CELL: 42,
  /** Clearance per side → bin footprint is 41.5mm per cell. */
  CLEARANCE: 0.25,
  /** One height unit "u". Per spec, total bin height = u × 7 (base included). */
  HEIGHT_UNIT: 7,

  /**
   * Bin foot Z-profile, bottom → top (total 4.75mm):
   *
   *   z 0.00→0.80  45° chamfer   width 35.60 → 37.20
   *   z 0.80→2.60  vertical      width 37.20
   *   z 2.60→4.75  45° chamfer   width 37.20 → 41.50
   */
  FOOT: {
    CHAMFER_BOTTOM: 0.8,
    STRAIGHT: 1.8,
    CHAMFER_TOP: 2.15,
    HEIGHT: 4.75, // 0.8 + 1.8 + 2.15
    /** Corner radius at the 41.5mm top; shrinks 1:1 with inset going down. */
    CORNER_RADIUS: 3.75,
  },

  /**
   * Stacking lip inner profile, top → bottom (total 4.4mm). The lip is a
   * PROTRUSION above the bin rim whose inner surface is the negative of the
   * foot, so a stacked bin self-centers. (Applied in F2.)
   */
  LIP: {
    CHAMFER_TOP: 0.7,
    STRAIGHT: 1.8,
    CHAMFER_BOTTOM: 1.9,
    HEIGHT: 4.4, // 0.7 + 1.8 + 1.9
  },

  MAGNET: {
    /** Hole centers form a 26×26mm square centered in each cell. */
    SPACING: 26,
    /** Standard hole for a 6×2mm magnet. */
    HOLE_DIAMETER: 6.5,
    HOLE_DEPTH: 2.4,
  },
} as const;
