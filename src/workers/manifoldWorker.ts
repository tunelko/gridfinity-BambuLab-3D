import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
import { generateBinPreview, generateBinExport, type BinConfig } from '../gridfinity/binGeometry';

let wasm: ManifoldToplevel | null = null;

async function ensureWasm(): Promise<ManifoldToplevel> {
  if (wasm) return wasm;
  const m = await Module();
  m.setup();
  wasm = m;
  return m;
}

function extractMesh(manifoldObj: any): { positions: Float32Array; indices: Uint32Array } {
  const mesh = manifoldObj.getMesh();
  const numVert: number = mesh.numVert;
  const numProp: number = mesh.numProp;
  const vertProps: Float32Array = mesh.vertProperties;
  const triVerts: Uint32Array = mesh.triVerts;

  const positions = new Float32Array(numVert * 3);
  for (let i = 0; i < numVert; i++) {
    const offset = i * numProp;
    positions[i * 3] = vertProps[offset];
    positions[i * 3 + 1] = vertProps[offset + 1];
    positions[i * 3 + 2] = vertProps[offset + 2];
  }

  return { positions, indices: new Uint32Array(triVerts) };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, config, requestId } = e.data as {
    type: 'preview' | 'export';
    config: BinConfig;
    requestId: string;
  };

  try {
    const m = await ensureWasm();

    const manifold = type === 'export'
      ? generateBinExport(m, config)
      : generateBinPreview(m, config);

    const { positions, indices } = extractMesh(manifold);
    manifold.delete();

    (self as any).postMessage(
      { type: 'mesh', requestId, positions, indices },
      [positions.buffer, indices.buffer],
    );
  } catch (err) {
    (self as any).postMessage({
      type: 'error',
      requestId,
      error: String(err),
    });
  }
};
