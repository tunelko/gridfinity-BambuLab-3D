import type { ManifoldToplevel } from 'manifold-3d';
import { BASEPLATE_SOCKET_PROFILE, SPEC } from './spec';
import { profileSolid } from './profiles';

/** Basic open-bottom baseplate; no magnets or mounting hardware. Z=0 is bed. */
export function generateBaseplate(wasm: ManifoldToplevel, cols: number, rows: number, segments = 16) {
  if (![cols, rows].every(n => Number.isInteger(n) && n >= 1 && n <= 50)) {
    throw new Error('Baseplate dimensions must be whole cells from 1 to 50');
  }
  const { HEIGHT, CORNER_RADIUS, FLOOR_CLEARANCE } = SPEC.BASEPLATE;
  const block = profileSolid(wasm, cols * SPEC.CELL, rows * SPEC.CELL,
    CORNER_RADIUS, [[0, 0], [HEIGHT, 0]], segments);
  const cutter = profileSolid(wasm, SPEC.CELL, SPEC.CELL, CORNER_RADIUS, [
    [-0.01, BASEPLATE_SOCKET_PROFILE[0][1]],
    ...BASEPLATE_SOCKET_PROFILE.map(([z, inset]) => [z + FLOOR_CLEARANCE, inset] as const),
    [HEIGHT + 0.01, -0.01],
  ], segments);
  const holes = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      holes.push(cutter.translate([
        (x - (cols - 1) / 2) * SPEC.CELL, (y - (rows - 1) / 2) * SPEC.CELL, 0,
      ]));
    }
  }
  // Cutters meet at the top; use a true union, never a disjoint compose.
  const sockets = wasm.Manifold.union(holes);
  const plate = block.subtract(sockets);
  block.delete(); cutter.delete(); sockets.delete();
  holes.forEach(hole => hole.delete());
  return plate;
}
