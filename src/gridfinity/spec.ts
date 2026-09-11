// Gridfinity community design reference, cross-checked against
// kennetek/gridfinity-rebuilt-openscad src/core/standard.scad.
// https://gridfinity.xyz/specification/ is a community draft, not a certification.
//
// All chamfers are 45°. "Inset" = horizontal distance from the 41.5mm cell
// boundary, per side.

export const SPEC = {
  /** Grid pitch. */
  CELL: 42,
  /** Perimeter clearance per side; footprint = units × 42 − 0.5. */
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
   * Female stacking socket, bottom → top. The theoretical sharp tip is
   * 4.4mm above the rim. Trim that tip to leave a printable 0.6mm crown.
   */
  LIP: {
    CHAMFER_BOTTOM: 0.7,
    STRAIGHT: 1.8,
    CHAMFER_TOP: 1.9,
    HEIGHT: 4.4, // 0.7 + 1.8 + 1.9
    TOP_TRIM: 0.6,
  },

  BASEPLATE: {
    HEIGHT: 5,
    CORNER_RADIUS: 4,
    PROFILE_HEIGHT: 4.65,
    FLOOR_CLEARANCE: 0.35,
  },

  MAGNET: {
    /** Hole centers form a 26×26mm square centered in each cell. */
    SPACING: 26,
    /** Standard hole for a 6×2mm magnet. */
    HOLE_DIAMETER: 6.5,
    HOLE_DEPTH: 2.4,
  },
} as const;

/** Profile vertices are [height, inset per side] relative to each outline. */
export type Profile = ReadonlyArray<readonly [number, number]>;

export const FOOT_PROFILE: Profile = [
  [0, 2.95], [0.8, 2.15], [2.6, 2.15], [4.75, 0],
];
export const LIP_SOCKET_PROFILE: Profile = [
  [0, 2.6], [0.7, 1.9], [2.5, 1.9], [4.4, 0],
];
// Relative to the 42mm cell outline, unlike the 41.5mm bin/lip outline.
export const BASEPLATE_SOCKET_PROFILE: Profile = [
  [0, 2.85], [0.7, 2.15], [2.5, 2.15], [4.65, 0],
];

export const PRINTED_LIP_HEIGHT = SPEC.LIP.HEIGHT - SPEC.LIP.TOP_TRIM;

export function binTotalHeight(bin: { h: number; stackingLip?: boolean }): number {
  return bin.h * SPEC.HEIGHT_UNIT + (bin.stackingLip ? PRINTED_LIP_HEIGHT : 0);
}
