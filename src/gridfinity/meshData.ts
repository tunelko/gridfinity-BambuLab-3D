import type { Manifold } from 'manifold-3d';

export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Preserve Z-up millimeters; Three.js conversion belongs only in the view. */
export function extractMesh(solid: Manifold): MeshData {
  if (solid.isEmpty() || String(solid.status()) !== 'NoError') {
    throw new Error('Geometry generation did not produce a valid solid');
  }
  const mesh = solid.getMesh();
  const positions = new Float32Array(mesh.numVert * 3);
  for (let i = 0; i < mesh.numVert; i++) {
    positions.set(mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3), i * 3);
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}
