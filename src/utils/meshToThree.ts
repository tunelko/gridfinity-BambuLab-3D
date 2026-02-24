import * as THREE from 'three';

/**
 * Converts a Manifold getMesh() result into a Three.js BufferGeometry.
 * Handles interleaved vertProperties with numProp >= 3.
 */
export function manifoldMeshToGeometry(manifoldObj: any): THREE.BufferGeometry {
  const mesh = manifoldObj.getMesh();
  const numVert: number = mesh.numVert;
  const numProp: number = mesh.numProp;
  const vertProps: Float32Array = mesh.vertProperties;
  const triVerts: Uint32Array = mesh.triVerts;

  // Extract positions from interleaved array
  const positions = new Float32Array(numVert * 3);
  for (let i = 0; i < numVert; i++) {
    const offset = i * numProp;
    positions[i * 3] = vertProps[offset];
    positions[i * 3 + 1] = vertProps[offset + 1];
    positions[i * 3 + 2] = vertProps[offset + 2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1));
  geometry.computeVertexNormals();

  return geometry;
}
