import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';

let instance: ManifoldToplevel | null = null;
let initPromise: Promise<ManifoldToplevel> | null = null;

export async function initManifold(): Promise<ManifoldToplevel> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const wasm = await Module();
    wasm.setup();
    instance = wasm;
    return wasm;
  })();

  return initPromise;
}

export function getManifold(): ManifoldToplevel | null {
  return instance;
}
