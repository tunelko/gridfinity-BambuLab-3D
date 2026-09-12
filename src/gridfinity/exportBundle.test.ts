import { beforeAll, expect, it } from 'vitest';
import JSZip from 'jszip';
import Module, { type ManifoldToplevel } from 'manifold-3d';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Vector3 } from 'three';
import { exportBinarySTL } from './exportStl';
import { exportPrintFile } from './exportBundle';
import { createFitKit } from './fitKit';
import { generateBinExport } from './binGeometry';
import { generateBaseplate } from './baseplateGeometry';
import { extractMesh } from './meshData';

const triangle = {
  vertices: new Float32Array([0, 0, 0, 2, 0, 0, 0, 3, 0]),
  triangles: new Uint32Array([0, 1, 2]),
};

it('writes little-endian binary STL facets with unit normals and unchanged coordinates', () => {
  const bytes = exportBinarySTL(triangle);
  const view = new DataView(bytes);
  expect(bytes.byteLength).toBe(84 + 50);
  expect(view.getUint32(80, true)).toBe(1);
  expect([0, 1, 2].map(i => view.getFloat32(84 + i * 4, true))).toEqual([0, 0, 1]);
  expect(Array.from({ length: 9 }, (_, i) => view.getFloat32(96 + i * 4, true)))
    .toEqual(Array.from(triangle.vertices));
  expect(view.getUint16(132, true)).toBe(0);
  const parsed = new STLLoader().parse(bytes);
  try { expect(Array.from(parsed.getAttribute('position').array)).toEqual(Array.from(triangle.vertices)); }
  finally { parsed.dispose(); }
});

it.each([
  { vertices: new Float32Array(), triangles: new Uint32Array() },
  { ...triangle, vertices: new Float32Array([0, 0]) },
  { ...triangle, vertices: new Float32Array([NaN, 0, 0, 2, 0, 0, 0, 3, 0]) },
  { ...triangle, triangles: new Uint32Array([0, 1]) },
  { ...triangle, triangles: new Uint32Array([0, 1, 3]) },
  { ...triangle, triangles: new Uint32Array([0, 1, 1]) },
])('rejects invalid STL input without producing a partial file: %#', mesh => {
  expect(() => exportBinarySTL(mesh)).toThrow();
});

it('omits only zero-area facets, preserving even very small printable facets', () => {
  const bytes = exportBinarySTL({
    vertices: new Float32Array([0, 0, 0, 1e-10, 0, 0, 0, 1e-10, 0]),
    triangles: new Uint32Array([0, 1, 1, 0, 1, 2]),
  });
  expect(new DataView(bytes).getUint32(80, true)).toBe(1);
  expect(bytes.byteLength).toBe(134);
});

it('defaults to a ZIP with collision-free safe names and never changes source meshes', async () => {
  const vertices = triangle.vertices.slice();
  const names = ['../part', '../part', 'CON', '', 'a/b\\c'];
  const output = await exportPrintFile(names.map(name => ({ name, mesh: triangle })), '../../layout');
  expect(output.filename).toBe('gridfinity_layout.zip');
  expect(output.blob.type).toBe('application/zip');
  const zip = await JSZip.loadAsync(await output.blob.arrayBuffer(), { checkCRC32: true });
  expect(Object.keys(zip.files).filter(name => name.endsWith('.stl'))).toEqual([
    'stl/001_part.stl', 'stl/002_part.stl', 'stl/003_CON.stl', 'stl/004_part.stl', 'stl/005_a_b_c.stl',
  ]);
  expect(await zip.file('README.txt')!.async('string')).toContain('millimetres');
  const model = await JSZip.loadAsync(await zip.file('model.3mf')!.async('uint8array'), { checkCRC32: true });
  expect(await model.file('3D/3dmodel.model')!.async('string')).toContain('name="../part"');
  expect(triangle.vertices).toEqual(vertices);
});

it('retains the direct 3MF option and rejects empty exports', async () => {
  const output = await exportPrintFile([{ name: 'One', mesh: triangle }], 'One', '3mf');
  expect(output.filename).toBe('gridfinity_One.3mf');
  const archive = await JSZip.loadAsync(await output.blob.arrayBuffer());
  expect(archive.file('3D/3dmodel.model')).not.toBeNull();
  expect(archive.file('model.3mf')).toBeNull();
  await expect(exportPrintFile([], 'empty')).rejects.toThrow('No meshes');
});

let wasm: ManifoldToplevel;
beforeAll(async () => { wasm = await Module(); wasm.setup(); });

it('the fit-kit ZIP contains all three printable STL meshes with the same placement as its 3MF', async () => {
  const meshes = await createFitKit({
    bin: async config => {
      const solid = generateBinExport(wasm, config);
      try { return extractMesh(solid); } finally { solid.delete(); }
    },
    plate: async ({ w, d }) => {
      const solid = generateBaseplate(wasm, w, d);
      try { return extractMesh(solid); } finally { solid.delete(); }
    },
  });
  const { blob } = await exportPrintFile(meshes, 'fit-test');
  const archive = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
  const nested = await JSZip.loadAsync(await archive.file('model.3mf')!.async('uint8array'));
  const xml = await nested.file('3D/3dmodel.model')!.async('string');
  const modelMeshes = [...xml.matchAll(/<mesh>([\s\S]*?)<\/mesh>/g)];
  expect(modelMeshes).toHaveLength(3);
  const files = Object.keys(archive.files).filter(name => name.endsWith('.stl'));
  expect(files).toHaveLength(3);
  for (let i = 0; i < files.length; i++) {
    const bytes = await archive.file(files[i])!.async('arraybuffer');
    const parsed = new STLLoader().parse(bytes);
    try {
      const positions = parsed.getAttribute('position');
      const modelVertices = [...modelMeshes[i][1].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)]
        .flatMap(m => m.slice(1).map(Number));
      const retainedIndices: number[] = [];
      const { vertices, triangles } = meshes[i].mesh;
      for (let j = 0; j < triangles.length; j += 3) {
        const a = new Vector3().fromArray(vertices, triangles[j] * 3);
        const b = new Vector3().fromArray(vertices, triangles[j + 1] * 3);
        const c = new Vector3().fromArray(vertices, triangles[j + 2] * 3);
        if (b.sub(a).cross(c.sub(a)).length() > 0) retainedIndices.push(...triangles.slice(j, j + 3));
      }
      expect(positions.count).toBe(retainedIndices.length);
      for (let j = 0; j < positions.count; j++) {
        for (let axis = 0; axis < 3; axis++) {
          expect(positions.array[j * 3 + axis])
            .toBeCloseTo(modelVertices[retainedIndices[j] * 3 + axis], 5);
        }
      }
      parsed.computeBoundingBox();
      const bounds = parsed.boundingBox!;
      expect(bounds.min.z).toBeCloseTo(0, 5);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(i === 2 ? 84 : 41.5, 4);
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(i === 2 ? 42 : 41.5, 4);
      expect(bounds.max.z).toBeCloseTo(i === 2 ? 5 : 10.8, 4);
      const roundTrip = new wasm.Mesh({
        numProp: 3, vertProperties: new Float32Array(positions.array),
        triVerts: Uint32Array.from({ length: positions.count }, (_, index) => index),
      });
      roundTrip.merge(); // STL duplicates vertices; weld them before manifold validation.
      const restored = new wasm.Manifold(roundTrip);
      const original = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: vertices, triVerts: triangles }));
      try {
        expect(String(restored.status())).toBe('NoError');
        expect(restored.volume()).toBeGreaterThan(0);
        expect(restored.volume()).toBeCloseTo(original.volume(), 4);
        const parts = restored.decompose();
        try { expect(parts).toHaveLength(1); } finally { parts.forEach(part => part.delete()); }
      } finally { restored.delete(); original.delete(); }
    } finally { parsed.dispose(); }
  }
});
