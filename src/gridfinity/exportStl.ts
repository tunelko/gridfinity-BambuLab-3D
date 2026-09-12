import type { TriangleMesh } from './export3mf';

function facetNormal(vertices: Float32Array, triangles: Uint32Array, offset: number): number[] {
  const a = triangles[offset] * 3;
  const b = triangles[offset + 1] * 3;
  const c = triangles[offset + 2] * 3;
  const ux = vertices[b] - vertices[a];
  const uy = vertices[b + 1] - vertices[a + 1];
  const uz = vertices[b + 2] - vertices[a + 2];
  const vx = vertices[c] - vertices[a];
  const vy = vertices[c + 1] - vertices[a + 1];
  const vz = vertices[c + 2] - vertices[a + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/** Binary STL: 80-byte header, uint32 facet count, 50 bytes per facet (LE).
 * Coordinates stay Z-up in millimetres; STL itself has no standard unit field.
 */
export function exportBinarySTL({ vertices, triangles }: TriangleMesh): ArrayBuffer {
  if (!vertices.length || vertices.length % 3 || !triangles.length || triangles.length % 3) {
    throw new Error('Invalid STL mesh buffers');
  }
  if (vertices.some(value => !Number.isFinite(value)) ||
      triangles.some(index => index >= vertices.length / 3)) {
    throw new Error('Invalid STL coordinates or triangle indices');
  }

  // Float32 mesh extraction can collapse an edge. Skip exactly zero-area
  // facets, never small positive-area ones; no printable surface is removed.
  const facets: number[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    if (Math.hypot(...facetNormal(vertices, triangles, i)) > 0) facets.push(i);
  }
  const count = facets.length;
  if (!count) throw new Error('No nondegenerate STL triangles');
  const buffer = new ArrayBuffer(84 + count * 50);
  new Uint8Array(buffer, 0, 80).set(new TextEncoder().encode('Gridfinity Builder; coordinates in millimetres; Z up'));
  const view = new DataView(buffer);
  view.setUint32(80, count, true);

  for (let i = 0; i < count; i++) {
    const facet = facets[i];
    const a = triangles[facet] * 3;
    const b = triangles[facet + 1] * 3;
    const c = triangles[facet + 2] * 3;
    const normal = facetNormal(vertices, triangles, facet);
    const length = Math.hypot(...normal);

    let offset = 84 + i * 50;
    for (const value of normal) { view.setFloat32(offset, value / length, true); offset += 4; }
    for (const index of [a, b, c]) {
      for (let axis = 0; axis < 3; axis++) {
        view.setFloat32(offset, vertices[index + axis], true);
        offset += 4;
      }
    }
    view.setUint16(offset, 0, true); // No colour or vendor-specific attributes.
  }
  return buffer;
}
