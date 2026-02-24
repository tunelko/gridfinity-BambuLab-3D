import type { ManifoldToplevel } from 'manifold-3d';
import { GF } from './constants';

const SEGMENTS_PER_CORNER = 16;

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

// ── Magnet & Screw Holes ─────────────────────────────────────────────────────

/**
 * Compute safe hole inset so cylinders clear the corner radius.
 * inset = max(8.0, cornerRadius + holeRadius + 1.0mm clearance)
 */
function safeHoleInset(cornerRadius: number, holeRadius: number): number {
  return Math.max(8.0, cornerRadius + holeRadius + 1.0);
}

/**
 * Collect unique hole positions across all cell corners, deduplicating
 * shared internal corners in multi-cell bins.
 */
function cellHolePositions(
  unitsW: number, unitsD: number, inset: number,
): [number, number][] {
  const halfCell = (GF.CELL_SIZE - GF.TOLERANCE) / 2;
  const holeOffset = halfCell - inset;
  const seen = new Set<string>();
  const positions: [number, number][] = [];

  for (let cx = 0; cx < unitsW; cx++) {
    for (let cy = 0; cy < unitsD; cy++) {
      const ox = (cx - (unitsW - 1) / 2) * GF.CELL_SIZE;
      const oy = (cy - (unitsD - 1) / 2) * GF.CELL_SIZE;
      for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const px = ox + dx * holeOffset;
        const py = oy + dy * holeOffset;
        // Round to 0.01mm to deduplicate overlapping corners
        const key = `${Math.round(px * 100)},${Math.round(py * 100)}`;
        if (!seen.has(key)) {
          seen.add(key);
          positions.push([px, py]);
        }
      }
    }
  }
  return positions;
}

function createMagnetHoles(
  wasm: ManifoldToplevel, unitsW: number, unitsD: number, cornerRadius: number,
): any {
  const holes: any[] = [];
  const r = (GF.MAGNET_DIAMETER + 0.5) / 2;
  const depth = GF.MAGNET_DEPTH + 0.4;
  const inset = safeHoleInset(cornerRadius, r);
  const positions = cellHolePositions(unitsW, unitsD, inset);

  for (const [px, py] of positions) {
    const hole = wasm.Manifold.cylinder(depth, r, r, 32);
    const pos = hole.translate([px, py, 0]);
    hole.delete();
    holes.push(pos);
  }
  return unionAll(wasm, holes);
}

function createScrewHoles(
  wasm: ManifoldToplevel, unitsW: number, unitsD: number, cornerRadius: number,
): any {
  const holes: any[] = [];
  const r = GF.SCREW_HOLE_DIAMETER / 2;
  const inset = safeHoleInset(cornerRadius, r);
  const positions = cellHolePositions(unitsW, unitsD, inset);

  for (const [px, py] of positions) {
    const hole = wasm.Manifold.cylinder(GF.BASE_TOTAL_HEIGHT, r, r, 32);
    const pos = hole.translate([px, py, 0]);
    hole.delete();
    holes.push(pos);
  }
  return unionAll(wasm, holes);
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

function applyHoles(wasm: ManifoldToplevel, bin: any, config: BinConfig): any {
  let result = bin;

  if (config.magnets) {
    try {
      const holes = createMagnetHoles(wasm, config.w, config.d, config.cornerRadius);
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
      const holes = createScrewHoles(wasm, config.w, config.d, config.cornerRadius);
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

  const outerW = config.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = config.d * GF.CELL_SIZE - GF.TOLERANCE;
  const bodyH = config.h * GF.HEIGHT_UNIT;
  const bodyStartZ = GF.BASE_TOTAL_HEIGHT;
  const bodyTopZ = bodyStartZ + bodyH;
  const r = Math.min(config.cornerRadius, outerW / 2, outerD / 2);
  const wall = config.wallThickness;
  const bottom = config.bottomThickness;
  const innerW = outerW - 2 * wall;
  const innerD = outerD - 2 * wall;
  const cavityStartZ = bodyStartZ + bottom;
  const cavityH = bodyH - bottom;

  // Label shelf (subtract from front wall)
  if (config.labelShelf && config.labelWidth > 0 && cavityH > 0) {
    try {
      const shelf = createLabelShelf(
        wasm, outerW, outerD, bodyStartZ, bodyTopZ,
        wall, config.labelWidth, r,
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
  if ((config.dividersX > 0 || config.dividersY > 0) && cavityH > 0) {
    try {
      const divs = createDividers(
        wasm, innerW, innerD, cavityStartZ, cavityH,
        wall, config.dividersX, config.dividersY,
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

export interface BinConfig {
  w: number;
  d: number;
  h: number;
  cornerRadius: number;
  wallThickness: number;
  bottomThickness: number;
  magnets?: boolean;
  screws?: boolean;
  labelShelf?: boolean;
  labelWidth?: number;
  dividersX?: number;
  dividersY?: number;
}

// ── PREVIEW geometry (for Three.js viewport) ─────────────────────────────────
//
// Flat base: single solid slab at full bin width, z=0→4.75.
// No feet, no steps, no chamfers.
// Body: straight vertical roundedBox, hollowed.
// Includes: label shelf, dividers, magnet/screw holes.

export function generateBinPreview(
  wasm: ManifoldToplevel,
  config: BinConfig,
): any {
  const outerW = config.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = config.d * GF.CELL_SIZE - GF.TOLERANCE;
  const bodyH = config.h * GF.HEIGHT_UNIT;
  const bodyStartZ = GF.BASE_TOTAL_HEIGHT;

  const r = Math.min(config.cornerRadius, outerW / 2, outerD / 2);

  // 1. Flat base (z=0 → z=4.75)
  const base = roundedBox(wasm, outerW, outerD, bodyStartZ, r);

  // 2. Hollow body (z=4.75 → top)
  const hollowBody = createHollowBody(
    wasm, outerW, outerD, bodyH, bodyStartZ,
    config.wallThickness, config.bottomThickness, r,
  );

  // 3. Union base + body
  let bin = base.add(hollowBody);
  base.delete();
  hollowBody.delete();

  // 4. Magnet & screw holes
  bin = applyHoles(wasm, bin, config);

  // 5. Label shelf + dividers
  bin = applyFeatures(wasm, bin, config);

  return bin;
}

// ── EXPORT geometry (for 3MF) ────────────────────────────────────────────────
//
// Full 5-layer Z-profile base per cell with exact dimensions for printing.
// Includes all features: label shelf, dividers, holes.

interface ZSection {
  zStart: number;
  height: number;
  shrinkBot: number;
  shrinkTop: number;
  rShrinkBot: number;
}

const Z_PROFILE_SECTIONS: ZSection[] = [
  { zStart: 0.00, height: 0.80, shrinkBot: 4.40, shrinkTop: 4.40, rShrinkBot: 2.20 },
  { zStart: 0.80, height: 0.80, shrinkBot: 4.40, shrinkTop: 2.80, rShrinkBot: 2.20 },
  { zStart: 1.60, height: 0.55, shrinkBot: 2.80, shrinkTop: 2.80, rShrinkBot: 1.40 },
  { zStart: 2.15, height: 0.80, shrinkBot: 2.80, shrinkTop: 1.20, rShrinkBot: 1.40 },
];

function createExportCellBase(wasm: ManifoldToplevel, cornerRadius: number): any {
  const cellSize = GF.CELL_SIZE - GF.TOLERANCE;
  const sections: any[] = [];

  for (const sec of Z_PROFILE_SECTIONS) {
    const wBot = cellSize - sec.shrinkBot;
    const wTop = cellSize - sec.shrinkTop;
    const rBot = Math.max(0, cornerRadius - sec.rShrinkBot);
    if (wBot <= 0 || sec.height <= 0) continue;

    const isChamfer = Math.abs(wBot - wTop) > 0.001;
    const poly = createRoundedRectPolygon(wBot, wBot, rBot);
    const cs = new wasm.CrossSection(poly);

    let solid: any;
    if (isChamfer) {
      const scale = wTop / wBot;
      solid = cs.extrude(sec.height, 0, 0, [scale, scale]);
    } else {
      solid = cs.extrude(sec.height);
    }
    cs.delete();

    const translated = solid.translate([0, 0, sec.zStart]);
    solid.delete();
    sections.push(translated);
  }

  // Layer 5: full cell width, z=2.95→4.75
  const slabH = GF.BASE_TOTAL_HEIGHT - 2.95;
  const slab = roundedBox(wasm, cellSize, cellSize, slabH, cornerRadius);
  const slabPos = slab.translate([0, 0, 2.95]);
  slab.delete();
  sections.push(slabPos);

  return unionAll(wasm, sections);
}

function createExportCellBases(wasm: ManifoldToplevel, unitsW: number, unitsD: number, cornerRadius: number): any {
  const cells: any[] = [];
  for (let cx = 0; cx < unitsW; cx++) {
    for (let cy = 0; cy < unitsD; cy++) {
      const offsetX = (cx - (unitsW - 1) / 2) * GF.CELL_SIZE;
      const offsetY = (cy - (unitsD - 1) / 2) * GF.CELL_SIZE;
      const cell = createExportCellBase(wasm, cornerRadius);
      const translated = cell.translate([offsetX, offsetY, 0]);
      cell.delete();
      cells.push(translated);
    }
  }
  return unionAll(wasm, cells);
}

export function generateBinExport(
  wasm: ManifoldToplevel,
  config: BinConfig,
): any {
  const outerW = config.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = config.d * GF.CELL_SIZE - GF.TOLERANCE;
  const bodyH = config.h * GF.HEIGHT_UNIT;
  const bodyStartZ = GF.BASE_TOTAL_HEIGHT;

  const r = Math.min(config.cornerRadius, outerW / 2, outerD / 2);

  // 1. Per-cell 5-layer Z-profile bases
  const cellBases = createExportCellBases(wasm, config.w, config.d, r);

  // 2. Full-width slab bridging inter-cell gaps (z=2.95→4.75)
  const slabH = bodyStartZ - 2.95;
  const slab = roundedBox(wasm, outerW, outerD, slabH, r);
  const slabPos = slab.translate([0, 0, 2.95]);
  slab.delete();

  const base = cellBases.add(slabPos);
  cellBases.delete();
  slabPos.delete();

  // 3. Hollow body
  const hollowBody = createHollowBody(
    wasm, outerW, outerD, bodyH, bodyStartZ,
    config.wallThickness, config.bottomThickness, r,
  );

  // 4. Union
  let bin = base.add(hollowBody);
  base.delete();
  hollowBody.delete();

  // 5. Holes
  bin = applyHoles(wasm, bin, config);

  // 6. Label shelf + dividers
  bin = applyFeatures(wasm, bin, config);

  return bin;
}
