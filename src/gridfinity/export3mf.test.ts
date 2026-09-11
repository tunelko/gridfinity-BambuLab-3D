import { beforeAll, expect, it } from 'vitest';
import Module, { type ManifoldToplevel } from 'manifold-3d';
import JSZip from 'jszip';
import { generateBinExport } from './binGeometry';
import { generateBaseplate } from './baseplateGeometry';
import { createFitKit } from './fitKit';
import { extractMesh } from './meshData';
import { exportTo3MF } from './export3mf';

let wasm: ManifoldToplevel;
beforeAll(async () => { wasm = await Module(); wasm.setup(); });

it('the actual ZIP/XML fit kit preserves millimeters, topology, placement and mating', async () => {
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
  const archive = await JSZip.loadAsync(await (await exportTo3MF(meshes)).arrayBuffer());
  const xml = await archive.file('3D/3dmodel.model')!.async('string');
  expect(xml).toContain('unit="millimeter"');
  expect(xml).not.toContain('transform=');
  expect([...xml.matchAll(/<item objectid="(\d+)"/g)].map(m => m[1])).toEqual(['2', '4', '6']);
  const solids = [...xml.matchAll(/<mesh>([\s\S]*?)<\/mesh>/g)].map(([, body]) => {
    const positions = [...body.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)]
      .flatMap(m => m.slice(1).map(Number));
    const indices = [...body.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)]
      .flatMap(m => m.slice(1).map(Number));
    const solid = new wasm.Manifold(new wasm.Mesh({
      numProp: 3, vertProperties: new Float32Array(positions), triVerts: new Uint32Array(indices),
    }));
    return solid;
  });
  try {
    expect(solids).toHaveLength(3);
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      expect(String(solid.status())).toBe('NoError');
      expect(solid.volume()).toBeGreaterThan(0);
      const parts = solid.decompose();
      expect(parts).toHaveLength(1);
      parts.forEach(part => part.delete());
      const b = solid.boundingBox();
      expect(b.min[2]).toBeCloseTo(0, 5);
      expect(b.max[0] - b.min[0]).toBeCloseTo(i === 2 ? 84 : 41.5, 4);
      expect(b.max[2]).toBeCloseTo(i === 2 ? 5 : 10.8, 4);
      for (const other of solids.slice(i + 1)) {
        const hit = solid.intersect(other);
        expect(hit.volume()).toBeLessThan(0.0001);
        hit.delete();
      }
    }
    const stacked = solids[1].translate([-50, 0, 7]);
    const stackingHit = solids[0].intersect(stacked);
    const onPlate = solids[0].translate([4, 50, 0.35]);
    const plateHit = solids[2].intersect(onPlate);
    try {
      expect(stackingHit.volume()).toBeLessThan(0.001);
      expect(plateHit.volume()).toBeLessThan(0.001);
    } finally { stacked.delete(); stackingHit.delete(); onPlate.delete(); plateHit.delete(); }
  } finally { solids.forEach(solid => solid.delete()); }
});
