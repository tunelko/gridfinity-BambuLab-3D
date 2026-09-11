import { mkdir, writeFile } from 'node:fs/promises';
import Module from 'manifold-3d';
import { createServer } from 'vite';

// Load the same TypeScript generators used by the browser without a second CAD implementation.
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { generateBinExport } = await server.ssrLoadModule('/src/gridfinity/binGeometry.ts');
  const { generateBaseplate } = await server.ssrLoadModule('/src/gridfinity/baseplateGeometry.ts');
  const { createFitKit } = await server.ssrLoadModule('/src/gridfinity/fitKit.ts');
  const { extractMesh } = await server.ssrLoadModule('/src/gridfinity/meshData.ts');
  const { exportTo3MF } = await server.ssrLoadModule('/src/gridfinity/export3mf.ts');
  const wasm = await Module();
  wasm.setup();
  const extract = solid => {
    try { return extractMesh(solid); } finally { solid.delete(); }
  };
  const meshes = await createFitKit({
    bin: async config => extract(generateBinExport(wasm, config)),
    plate: async ({ w, d }) => extract(generateBaseplate(wasm, w, d)),
  });
  const blob = await exportTo3MF(meshes);
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/gridfinity-fit-test.3mf', Buffer.from(await blob.arrayBuffer()));
  console.log('Created artifacts/gridfinity-fit-test.3mf: two 1x1x1u bins and a 2x1 baseplate.');
} finally { await server.close(); }
