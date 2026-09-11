import type { ManifoldToplevel } from 'manifold-3d';
import type { Profile } from './spec';

/** Loft exact profile stations, with concentric corners (no scaled extrusion).
 * Explicit rings avoid thin-disc hulls introducing tiny ledges at transitions.
 * All mating profiles have positive corner radii and increasing Z stations.
 */
export function profileSolid(
  wasm: ManifoldToplevel, width: number, depth: number, radius: number,
  profile: Profile, segments = 16,
) {
  const vertices: number[] = [];
  const triangles: number[] = [];
  const count = 4 * (segments + 1);
  for (const [z, inset] of profile) {
    const r = radius - inset;
    if (r <= 0 || width <= 2 * radius || depth <= 2 * radius) {
      throw new Error('Invalid rounded mating profile');
    }
    const x = width / 2 - radius, y = depth / 2 - radius;
    for (const [cx, cy, start] of [[x, -y, -90], [x, y, 0], [-x, y, 90], [-x, -y, 180]]) {
      for (let i = 0; i <= segments; i++) {
        const angle = (start + i * 90 / segments) * Math.PI / 180;
        vertices.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle), z);
      }
    }
  }
  for (let level = 0; level < profile.length - 1; level++) {
    if (profile[level + 1][0] <= profile[level][0]) throw new Error('Profile Z must increase');
    for (let i = 0; i < count; i++) {
      const a = level * count + i, b = level * count + (i + 1) % count;
      triangles.push(a, b, b + count, a, b + count, a + count);
    }
  }
  const bottom = vertices.length / 3;
  vertices.push(0, 0, profile[0][0], 0, 0, profile[profile.length - 1][0]);
  const top = (profile.length - 1) * count;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    triangles.push(bottom, next, i, bottom + 1, top + i, top + next);
  }
  return new wasm.Manifold(new wasm.Mesh({
    numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(triangles),
  }));
}
