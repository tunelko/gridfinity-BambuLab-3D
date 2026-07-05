import type { ManifoldToplevel } from 'manifold-3d';
import { GF } from './constants';
import { SPEC } from './spec';

// Curve tessellation — set per generation by quality ('preview' uses fewer
// segments for fast interactive CSG; 'export' full quality for printing).
let SEGMENTS_PER_CORNER = 16;
let CYLINDER_SEGMENTS = 32;

// ── Helpers ──────────────────────────────────────────────────────────────────

function createRoundedRectPolygon(
  w: number,
  d: number,
  radius: number,
): [number, number][] {
  const r = Math.min(Math.max(0, radius), w / 2, d / 2);

  if (r <= 0) {
    const hw = w / 2, hd = d / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  }

  const hw = w / 2, hd = d / 2;
  const points: [number, number][] = [];

  const corners: [number, number, number][] = [
    [hw - r, -hd + r, -Math.PI / 2],
    [hw - r, hd - r, 0],
    [-hw + r, hd - r, Math.PI / 2],
    [-hw + r, -hd + r, Math.PI],
  ];

  for (const [cx, cy, startAngle] of corners) {
    for (let i = 0; i <= SEGMENTS_PER_CORNER; i++) {
      const angle = startAngle + (i / SEGMENTS_PER_CORNER) * (Math.PI / 2);
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }

  return points;
}

/** Creates a rounded box: centered on XY, from Z=0 to Z=h. */
function roundedBox(
  wasm: ManifoldToplevel,
  w: number,
  d: number,
  h: number,
  radius: number,
): any {
  if (h <= 0) return wasm.Manifold.cube([0.001, 0.001, 0.001], true);

  if (radius <= 0) {
    return wasm.Manifold.cube([w, d, h]).translate([-w / 2, -d / 2, 0]);
  }

  const poly = createRoundedRectPolygon(w, d, radius);
  const cs = new wasm.CrossSection(poly);
  const solid = cs.extrude(h);
  cs.delete();
  return solid;
}

/** Pairwise union of an array of manifolds. Deletes all inputs. */
function unionAll(wasm: ManifoldToplevel, parts: any[]): any {
  if (parts.length === 0) return wasm.Manifold.cube([0.001, 0.001, 0.001], true);
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const next = result.add(parts[i]);
    result.delete();
    parts[i].delete();
    result = next;
  }
  return result;
}

/**
 * Lazy-union of provably DISJOINT manifolds (pure topology, no boolean cost).
 * Only valid when parts cannot touch or overlap. Deletes all inputs.
 */
function composeAll(wasm: ManifoldToplevel, parts: any[]): any {
  if (parts.length === 0) return wasm.Manifold.cube([0.001, 0.001, 0.001], true);
  const out = wasm.Manifold.compose(parts);
  for (const p of parts) p.delete();
  return out;
}

// ── Magnet & Screw Holes ─────────────────────────────────────────────────────

/**
 * Spec hole offset from each cell center: 26mm spacing → ±13mm.
 * Clamped inward only for oversized custom magnets so the hole stays
 * inside the 35.6mm foot bottom (17.8mm half-width).
 */
function specHoleOffset(holeRadius: number): number {
  const footHalfBottom =
    (GF.CELL_SIZE - GF.TOLERANCE) / 2 - (SPEC.FOOT.CHAMFER_BOTTOM + SPEC.FOOT.CHAMFER_TOP);
  return Math.min(SPEC.MAGNET.SPACING / 2, footHalfBottom - holeRadius - 0.5);
}

/**
 * Hole positions: a 26×26mm square centered in each cell of the bin
 * (official magnet grid).
 */
function cellHolePositions(
  unitsW: number, unitsD: number, holeOffset: number,
): [number, number][] {
  const positions: [number, number][] = [];

  for (let cx = 0; cx < unitsW; cx++) {
    for (let cy = 0; cy < unitsD; cy++) {
      const ox = (cx - (unitsW - 1) / 2) * GF.CELL_SIZE;
      const oy = (cy - (unitsD - 1) / 2) * GF.CELL_SIZE;
      for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        positions.push([ox + dx * holeOffset, oy + dy * holeOffset]);
      }
    }
  }
  return positions;
}

function createMagnetHoles(
  wasm: ManifoldToplevel, unitsW: number, unitsD: number,
  magnetDiameter: number, magnetDepth: number,
): any {
  const holes: any[] = [];
  const r = (magnetDiameter + 0.5) / 2; // +0.5mm clearance for press-fit
  const depth = magnetDepth + 0.4;      // +0.4mm so magnet sits flush
  const positions = cellHolePositions(unitsW, unitsD, specHoleOffset(r));

  for (const [px, py] of positions) {
    const hole = wasm.Manifold.cylinder(depth, r, r, CYLINDER_SEGMENTS);
    const pos = hole.translate([px, py, 0]);
    hole.delete();
    holes.push(pos);
  }
  // Holes are ≥16mm apart center-to-center — disjoint by construction.
  return composeAll(wasm, holes);
}

function createScrewHoles(
  wasm: ManifoldToplevel, unitsW: number, unitsD: number,
): any {
  const holes: any[] = [];
  const r = GF.SCREW_HOLE_DIAMETER / 2;
  const positions = cellHolePositions(unitsW, unitsD, specHoleOffset(r));

  for (const [px, py] of positions) {
    const hole = wasm.Manifold.cylinder(GF.BASE_TOTAL_HEIGHT, r, r, CYLINDER_SEGMENTS);
    const pos = hole.translate([px, py, 0]);
    hole.delete();
    holes.push(pos);
  }
  return composeAll(wasm, holes);
}

// ── Label Shelf ──────────────────────────────────────────────────────────────

/**
 * Creates a label shelf cutout: 45° wedge subtracted from the front (+Y) wall.
 *
 * Side view (YZ plane, looking from +X):
 *
 *      bodyTopZ ── A────────────B  ← rim / top of bin
 *                  │  ·  45°    │
 *                  │     ·      │
 *   bodyTopZ - H ──│        · · C  ← bottom of shelf meets outer wall
 *                  │            │
 *                  │   wall     │
 *                  │            │
 *              innerFace    outerFace
 *          (outerD/2-wall)  (outerD/2)
 *
 * At the rim: the wedge cuts through the full wall + shelfDepth into the bin.
 * At the bottom: the wedge tapers to just the outer face.
 * The 45° slope inside is where a label rests.
 */
function createLabelShelf(
  wasm: ManifoldToplevel,
  outerW: number, outerD: number,
  _bodyStartZ: number, bodyTopZ: number,
  wall: number, shelfWidth: number, _r: number,
): any {
  const innerW = outerW - 2 * wall;
  const shelfDepth = Math.min(shelfWidth, outerD / 2);
  const angleRad = (GF.LABEL_ANGLE * Math.PI) / 180;
  const shelfH = shelfDepth * Math.tan(angleRad); // at 45°, shelfH ≈ shelfDepth

  const eps = 0.5; // overshoot for clean boolean
  const xSpan = innerW + 2 * eps;

  // Rectangle in XY: X spans bin width, Y from -shelfDepth to +eps.
  // Y=0 is aligned with the outer wall face (outerD/2).
  // Taper [1, 0.001] collapses Y toward 0 (outer face) at extrusion top.
  const rectPoints: [number, number][] = [
    [-xSpan / 2, -shelfDepth],
    [xSpan / 2, -shelfDepth],
    [xSpan / 2, eps],
    [-xSpan / 2, eps],
  ];

  const rectCs = new wasm.CrossSection(rectPoints);
  // Extrude along Z by shelfH. At Z=0 (base) full rectangle; at Z=shelfH (top) collapsed to Y≈0.
  const wedge = rectCs.extrude(shelfH, 0, 0, [1, 0.001]);
  rectCs.delete();

  // Mirror Z so the FULL end is at Z=0 and COLLAPSED end is at Z=-shelfH.
  const mirrored = wedge.mirror([0, 0, 1]);
  wedge.delete();

  // Translate: Y=0 → outerD/2 (outer face), Z=0 → bodyTopZ (rim).
  // Result: full cut at rim (bodyTopZ), tapers to outer face at (bodyTopZ - shelfH).
  const positioned = mirrored.translate([0, outerD / 2, bodyTopZ]);
  mirrored.delete();

  return positioned;
}

// ── Dividers ─────────────────────────────────────────────────────────────────

function createDividers(
  wasm: ManifoldToplevel,
  innerW: number, innerD: number,
  cavityStartZ: number, cavityH: number,
  wall: number,
  dividersX: number, dividersY: number,
): any {
  const dividers: any[] = [];
  const divThick = wall; // dividers same thickness as walls

  // X dividers: vertical walls parallel to Y axis, dividing X span
  if (dividersX > 0) {
    for (let i = 1; i <= dividersX; i++) {
      const x = -innerW / 2 + (innerW / (dividersX + 1)) * i;
      const div = wasm.Manifold.cube([divThick, innerD, cavityH])
        .translate([x - divThick / 2, -innerD / 2, cavityStartZ]);
      dividers.push(div);
    }
  }

  // Y dividers: vertical walls parallel to X axis, dividing Y span
  if (dividersY > 0) {
    for (let i = 1; i <= dividersY; i++) {
      const y = -innerD / 2 + (innerD / (dividersY + 1)) * i;
      const div = wasm.Manifold.cube([innerW, divThick, cavityH])
        .translate([-innerW / 2, y - divThick / 2, cavityStartZ]);
      dividers.push(div);
    }
  }

  if (dividers.length === 0) return null;
  return unionAll(wasm, dividers);
}

// ── Shared: hollow body + features ───────────────────────────────────────────

function createHollowBody(
  wasm: ManifoldToplevel,
  outerW: number, outerD: number,
  bodyH: number, bodyStartZ: number,
  wall: number, bottom: number,
  r: number,
): any {
  const innerW = outerW - 2 * wall;
  const innerD = outerD - 2 * wall;
  const innerR = Math.max(0, r - wall);

  const outerBody = roundedBox(wasm, outerW, outerD, bodyH, r);
  const outerBodyPos = outerBody.translate([0, 0, bodyStartZ]);
  outerBody.delete();

  const cavityStartZ = bodyStartZ + bottom;
  const cavityH = bodyH - bottom + 0.1; // overshoot for clean open top

  if (innerW > 0 && innerD > 0 && cavityH > 0) {
    const cavity = roundedBox(wasm, innerW, innerD, cavityH, innerR);
    const cavityPos = cavity.translate([0, 0, cavityStartZ]);
    cavity.delete();

    const hollow = outerBodyPos.subtract(cavityPos);
    outerBodyPos.delete();
    cavityPos.delete();
    return hollow;
  }
  return outerBodyPos;
}

// ── Stacking Lip ─────────────────────────────────────────────────────────────
//
// Official Gridfinity stacking lip: a perimeter PROTRUSION above the top rim
// whose inner surface is the negative of the foot profile, so the feet of an
// identical bin dropped on top self-center on the 45° seat and nest ~4.05mm
// deep (the foot bottom rests 0.35mm above the rim).
//
// Inner-face insets from the bin outline (rim at z=R, lip total 4.4mm):
//
//   z R+4.40  inset 0.70   ← mouth (widest opening, guides the foot in)
//      ↓ 45° seat chamfer — full-face contact with the foot's 2.15 chamfer
//   z R+2.95  inset 2.15
//      ↓ vertical, inset 1.90 (foot straight section 2.15 − 0.25 clearance)
//   z R+0.00  inset 1.90
//      ↓ 45° support chamfer merging into the wall (printable underside)
//   z R−(1.90−wall)  inset wall
//
// Ring cross-sections are not convex, so the lip is built as an outline block
// MINUS an inner negative assembled from convex hulls of rounded-rect discs
// (same technique as the foot chamfers — corner radii shrink 1:1 with inset).
function createStackingLip(
  wasm: ManifoldToplevel,
  outerW: number, outerD: number,
  bodyTopZ: number,
  r: number,
  wall: number,
): any {
  const LIP_H = SPEC.LIP.HEIGHT;                        // 4.40
  const seatBotInset = SPEC.FOOT.CHAMFER_TOP;           // 2.15
  const wallInset = seatBotInset - SPEC.CLEARANCE;      // 1.90
  // Seat bottom (rim-relative): foot chamfer start when seated 0.35 up.
  const seatBotZ = SPEC.FOOT.CHAMFER_BOTTOM + SPEC.FOOT.STRAIGHT + 0.35; // 2.95
  const supportH = Math.max(0, wallInset - wall);       // 0.70 @ 1.2mm wall
  const eps = 0.01;
  const overshoot = 0.15;

  function disc(inset: number, zTop: number): any {
    const d = roundedBox(
      wasm, outerW - 2 * inset, outerD - 2 * inset, eps, Math.max(0, r - inset),
    );
    const pos = d.translate([0, 0, zTop - eps]);
    d.delete();
    return pos;
  }

  // Outline block spanning support chamfer + lip.
  const block = roundedBox(wasm, outerW, outerD, supportH + LIP_H, r);
  const blockPos = block.translate([0, 0, bodyTopZ - supportH]);
  block.delete();

  const negatives: any[] = [];

  // Support chamfer: inset wall @ (R − supportH) → inset 1.90 @ R.
  // Cross-sections here NARROW upward, so the cone binds to the discs' TOP
  // edges — place those at exact heights for a true 45°.
  if (supportH > 0) {
    const s0 = disc(wall, bodyTopZ - supportH);
    const s1 = disc(wallInset, bodyTopZ);
    negatives.push(wasm.Manifold.hull([s0, s1]));
    s0.delete(); s1.delete();
  }

  // Vertical section: inset 1.90, z R → R+2.95.
  const vPoly = createRoundedRectPolygon(
    outerW - 2 * wallInset, outerD - 2 * wallInset, Math.max(0, r - wallInset),
  );
  const vCs = new wasm.CrossSection(vPoly);
  const vSolid = vCs.extrude(seatBotZ + eps);
  vCs.delete();
  const vPos = vSolid.translate([0, 0, bodyTopZ]);
  vSolid.delete();
  negatives.push(vPos);

  // Seat chamfer: inset 2.15 @ R+2.95 → past the lip top for a clean cut
  // (inset 0.70 at R+4.40, continuing the 45° slope). Cross-sections widen
  // upward → cone binds to BOTTOM edges; both placed at exact heights so the
  // seat plane is coplanar with the foot's 2.15 chamfer.
  const c0 = disc(seatBotInset, bodyTopZ + seatBotZ + eps);
  const c1 = disc(
    seatBotInset - (LIP_H - seatBotZ) - overshoot,
    bodyTopZ + LIP_H + overshoot + eps,
  );
  negatives.push(wasm.Manifold.hull([c0, c1]));
  c0.delete(); c1.delete();

  const negative = unionAll(wasm, negatives);
  const lip = blockPos.subtract(negative);
  blockPos.delete();
  negative.delete();
  return lip;
}

function applyHoles(wasm: ManifoldToplevel, bin: any, config: BinConfig): any {
  let result = bin;

  if (config.magnets) {
    try {
      const holes = createMagnetHoles(
        wasm, config.w, config.d,
        config.magnetDiameter ?? GF.MAGNET_DIAMETER,
        config.magnetDepth ?? GF.MAGNET_DEPTH,
      );
      const after = result.subtract(holes);
      result.delete();
      holes.delete();
      result = after;
    } catch (err) {
      console.warn('[BIN] magnet holes failed:', err);
    }
  }

  if (config.screws) {
    try {
      const holes = createScrewHoles(wasm, config.w, config.d);
      const after = result.subtract(holes);
      result.delete();
      holes.delete();
      result = after;
    } catch (err) {
      console.warn('[BIN] screw holes failed:', err);
    }
  }

  return result;
}

function applyFeatures(wasm: ManifoldToplevel, bin: any, config: BinConfig): any {
  let result = bin;

  const labelWidth = config.labelWidth ?? GF.LABEL_DEFAULT_WIDTH;
  const dividersX = config.dividersX ?? 0;
  const dividersY = config.dividersY ?? 0;

  const outerW = config.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = config.d * GF.CELL_SIZE - GF.TOLERANCE;
  const bodyH = bodyHeight(config.h);
  const bodyStartZ = GF.BASE_TOTAL_HEIGHT;
  const bodyTopZ = bodyStartZ + bodyH;
  const r = Math.min(config.cornerRadius, outerW / 2, outerD / 2);
  const wall = config.wallThickness;
  const bottom = config.bottomThickness;
  const innerW = outerW - 2 * wall;
  const innerD = outerD - 2 * wall;
  const cavityStartZ = bodyStartZ + bottom;
  const cavityH = bodyH - bottom;

  // Stacking lip (protrusion added above the rim so identical bins nest)
  if (config.stackingLip && cavityH > 0) {
    try {
      const lip = createStackingLip(wasm, outerW, outerD, bodyTopZ, r, wall);
      const after = result.add(lip);
      result.delete();
      lip.delete();
      result = after;
    } catch (err) {
      console.warn('[BIN] stacking lip failed:', err);
    }
  }

  // Label shelf (subtract from front wall)
  if (config.labelShelf && labelWidth > 0 && cavityH > 0) {
    try {
      const shelf = createLabelShelf(
        wasm, outerW, outerD, bodyStartZ, bodyTopZ,
        wall, labelWidth, r,
      );
      const after = result.subtract(shelf);
      result.delete();
      shelf.delete();
      result = after;
    } catch (err) {
      console.warn('[BIN] label shelf failed:', err);
    }
  }

  // Dividers (add internal walls)
  if ((dividersX > 0 || dividersY > 0) && cavityH > 0) {
    try {
      const divs = createDividers(
        wasm, innerW, innerD, cavityStartZ, cavityH,
        wall, dividersX, dividersY,
      );
      if (divs) {
        const after = result.add(divs);
        result.delete();
        divs.delete();
        result = after;
      }
    } catch (err) {
      console.warn('[BIN] dividers failed:', err);
    }
  }

  return result;
}

// ── Config ───────────────────────────────────────────────────────────────────

/**
 * Body height above the base. Per spec, TOTAL bin height = u × 7mm with the
 * 4.75mm base included (the stacking lip protrudes above and doesn't count).
 */
function bodyHeight(units: number): number {
  return Math.max(0.5, units * GF.HEIGHT_UNIT - GF.BASE_TOTAL_HEIGHT);
}

export interface BinConfig {
  w: number;
  d: number;
  h: number;
  cornerRadius: number;
  wallThickness: number;
  bottomThickness: number;
  magnets?: boolean;
  magnetDiameter?: number;
  magnetDepth?: number;
  screws?: boolean;
  stackingLip?: boolean;
  labelShelf?: boolean;
  labelWidth?: number;
  dividersX?: number;
  dividersY?: number;
}

/**
 * Map a store bin (or any bin-shaped object) to the geometry config.
 * Single source for the Bin→BinConfig field list — a missed field here used
 * to silently drop features from preview/export (it happened to stackingLip).
 */
export function binToConfig(bin: {
  w: number; d: number; h: number;
  cornerRadius: number; wallThickness: number; bottomThickness: number;
  magnets: boolean; magnetDiameter?: number; magnetDepth?: number;
  screws: boolean; stackingLip: boolean;
  labelShelf: boolean; labelWidth: number;
  dividersX: number; dividersY: number;
}): BinConfig {
  return {
    w: bin.w, d: bin.d, h: bin.h,
    cornerRadius: bin.cornerRadius,
    wallThickness: bin.wallThickness,
    bottomThickness: bin.bottomThickness,
    magnets: bin.magnets,
    magnetDiameter: bin.magnetDiameter,
    magnetDepth: bin.magnetDepth,
    screws: bin.screws,
    stackingLip: bin.stackingLip,
    labelShelf: bin.labelShelf,
    labelWidth: bin.labelWidth,
    dividersX: bin.dividersX,
    dividersY: bin.dividersY,
  };
}

// ── Geometry generation ──────────────────────────────────────────────────────
//
// ONE generator for both the 3D preview and the 3MF export — what you see is
// what you print. `quality` only changes curve tessellation:
//   'preview' → coarser corners/cylinders for fast interactive CSG
//   'export'  → full resolution for printing

// Official Gridfinity foot Z-profile per cell (cell = 41.5mm after tolerance),
// values from SPEC.FOOT — see spec.ts. Bottom → top:
//   z 0.00→0.80  45° chamfer  35.60 → 37.20
//   z 0.80→2.60  vertical     37.20
//   z 2.60→4.75  45° chamfer  37.20 → 41.50   (meets the bin body flush)
//
// Chamfers are built as convex hulls of two thin rounded-rect discs so the
// corner radius shrinks 1:1 with the inset (true 45° offset surface). A scaled
// extrude would shrink corners proportionally instead, leaving foot corners
// too square to enter a baseplate socket.
function createExportCellBase(wasm: ManifoldToplevel): any {
  const cellSize = GF.CELL_SIZE - GF.TOLERANCE;
  const { CHAMFER_BOTTOM, STRAIGHT, CHAMFER_TOP, HEIGHT, CORNER_RADIUS } = SPEC.FOOT;
  const insetLow = CHAMFER_BOTTOM + CHAMFER_TOP; // 2.95 → width 35.60
  const insetMid = CHAMFER_TOP;                  // 2.15 → width 37.20
  const eps = 0.01;

  // Thin disc of the foot cross-section at a given inset, top face at z.
  function disc(inset: number, zTop: number): any {
    const w = cellSize - 2 * inset;
    const d = roundedBox(wasm, w, w, eps, Math.max(0, CORNER_RADIUS - inset));
    const pos = d.translate([0, 0, zTop - eps]);
    d.delete();
    return pos;
  }

  // Bottom chamfer: 35.60 @ z0 → 37.20 @ z0.80.
  // Disc Z placement: the hull cone binds to each disc's BOTTOM edge here
  // (cross-sections widen upward), so both bottom edges sit at exact heights
  // to keep the cone at exactly 45° — the mating faces must be coplanar.
  const b0 = disc(insetLow, eps);
  const b1 = disc(insetMid, CHAMFER_BOTTOM + eps);
  const bottomChamfer = wasm.Manifold.hull([b0, b1]);
  b0.delete(); b1.delete();

  // Vertical section: 37.20, z 0.80→2.60
  const midPoly = createRoundedRectPolygon(
    cellSize - 2 * insetMid, cellSize - 2 * insetMid, CORNER_RADIUS - insetMid,
  );
  const midCs = new wasm.CrossSection(midPoly);
  const midSolid = midCs.extrude(STRAIGHT);
  midCs.delete();
  const straight = midSolid.translate([0, 0, CHAMFER_BOTTOM]);
  midSolid.delete();

  // Top chamfer: 37.20 @ z2.60 → 41.50 @ z4.75 (bottom edges exact, as above;
  // t1 overshoots 0.01 into the body, which the union absorbs)
  const t0 = disc(insetMid, CHAMFER_BOTTOM + STRAIGHT + eps);
  const t1 = disc(0, HEIGHT + eps);
  const topChamfer = wasm.Manifold.hull([t0, t1]);
  t0.delete(); t1.delete();

  return unionAll(wasm, [bottomChamfer, straight, topChamfer]);
}

function createExportCellBases(wasm: ManifoldToplevel, unitsW: number, unitsD: number): any {
  const cells: any[] = [];
  for (let cx = 0; cx < unitsW; cx++) {
    for (let cy = 0; cy < unitsD; cy++) {
      const offsetX = (cx - (unitsW - 1) / 2) * GF.CELL_SIZE;
      const offsetY = (cy - (unitsD - 1) / 2) * GF.CELL_SIZE;
      const cell = createExportCellBase(wasm);
      const translated = cell.translate([offsetX, offsetY, 0]);
      cell.delete();
      cells.push(translated);
    }
  }
  // Feet are separated by the 0.5mm inter-cell V-groove — disjoint.
  return composeAll(wasm, cells);
}

export type GeometryQuality = 'preview' | 'export';

export function generateBin(
  wasm: ManifoldToplevel,
  config: BinConfig,
  quality: GeometryQuality = 'export',
): any {
  SEGMENTS_PER_CORNER = quality === 'preview' ? 8 : 16;
  CYLINDER_SEGMENTS = quality === 'preview' ? 20 : 32;

  const outerW = config.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = config.d * GF.CELL_SIZE - GF.TOLERANCE;
  const bodyH = bodyHeight(config.h);
  const bodyStartZ = GF.BASE_TOTAL_HEIGHT;

  const r = Math.min(config.cornerRadius, outerW / 2, outerD / 2);

  // 1. Per-cell official foot profile (reaches full 41.5mm width at z=4.75,
  //    so the body bottom face seals the base; the 0.5mm V-grooves between
  //    feet of multi-cell bins stay open underneath, per spec)
  const base = createExportCellBases(wasm, config.w, config.d);

  // 2. Hollow body
  const hollowBody = createHollowBody(
    wasm, outerW, outerD, bodyH, bodyStartZ,
    config.wallThickness, config.bottomThickness, r,
  );

  // 3. Union
  let bin = base.add(hollowBody);
  base.delete();
  hollowBody.delete();

  // 4. Holes
  bin = applyHoles(wasm, bin, config);

  // 5. Stacking lip + label shelf + dividers
  bin = applyFeatures(wasm, bin, config);

  return bin;
}

export function generateBinPreview(wasm: ManifoldToplevel, config: BinConfig): any {
  return generateBin(wasm, config, 'preview');
}

export function generateBinExport(wasm: ManifoldToplevel, config: BinConfig): any {
  return generateBin(wasm, config, 'export');
}
