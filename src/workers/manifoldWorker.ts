import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
import { generateBinPreview, generateBinExport, type BinConfig } from '../gridfinity/binGeometry';
import { generateBaseplate } from '../gridfinity/baseplateGeometry';
import { extractMesh } from '../gridfinity/meshData';

let wasm: Promise<ManifoldToplevel> | null = null;

async function ensureWasm(): Promise<ManifoldToplevel> {
  if (wasm) return wasm;
  wasm = Module().then(m => { m.setup(); return m; }).catch(err => {
    wasm = null;
    throw err;
  });
  return wasm;
}

self.onmessage = async (e: MessageEvent) => {
  // Origin check (CodeQL js/missing-origin-check): dedicated workers only
  // receive messages from the page that spawned them (e.origin is ""), so
  // reject anything claiming a foreign origin, then validate the message
  // shape before acting on it.
  if (e.origin && e.origin !== self.location.origin) return;

  const { type, config, requestId } = (e.data ?? {}) as {
    type?: unknown;
    config?: BinConfig;
    requestId?: unknown;
  };
  if ((type !== 'preview' && type !== 'export' && type !== 'baseplate') || typeof requestId !== 'string' || !config) {
    return;
  }

  try {
    const m = await ensureWasm();

    const manifold = type === 'baseplate'
      ? generateBaseplate(m, config.w, config.d)
      : type === 'export'
      ? generateBinExport(m, config)
      : generateBinPreview(m, config);

    try {
      const { positions, indices } = extractMesh(manifold);
      (self as any).postMessage(
        { type: 'mesh', requestId, positions, indices },
        [positions.buffer, indices.buffer],
      );
    } finally { manifold.delete(); }
  } catch (err) {
    (self as any).postMessage({
      type: 'error',
      requestId,
      error: String(err),
    });
  }
};
