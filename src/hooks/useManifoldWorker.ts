import type { BinConfig } from '../gridfinity/binGeometry';

type MeshResult = { positions: Float32Array; indices: Uint32Array };
type Callback = (result: MeshResult) => void;
type ErrorCallback = (err: string) => void;

let worker: Worker | null = null;
const pending = new Map<string, { resolve: Callback; reject: ErrorCallback }>();
let idCounter = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/manifoldWorker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e: MessageEvent) => {
      const { type, requestId, positions, indices, error } = e.data;
      const entry = pending.get(requestId);
      if (!entry) return;
      pending.delete(requestId);

      if (type === 'mesh') {
        entry.resolve({ positions, indices });
      } else if (type === 'error') {
        entry.reject(error);
      }
    };
  }
  return worker;
}

function configHash(config: BinConfig): string {
  return JSON.stringify(config);
}

// Cache: hash → mesh data. Bounded LRU — mesh buffers are large (hundreds of
// KB each) and an unbounded map grows for every slider tick of every bin.
const MESH_CACHE_MAX = 60;
const meshCache = new Map<string, MeshResult>();

function cacheGet(hash: string): MeshResult | undefined {
  const hit = meshCache.get(hash);
  if (hit) {
    // Refresh recency (Map preserves insertion order)
    meshCache.delete(hash);
    meshCache.set(hash, hit);
  }
  return hit;
}

function cacheSet(hash: string, value: MeshResult) {
  meshCache.set(hash, value);
  if (meshCache.size > MESH_CACHE_MAX) {
    const oldest = meshCache.keys().next().value as string;
    meshCache.delete(oldest);
  }
}

export function requestMesh(
  mode: 'preview' | 'export',
  config: BinConfig,
): Promise<MeshResult> {
  const hash = mode + ':' + configHash(config);
  const cached = cacheGet(hash);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const requestId = `req_${++idCounter}`;
    pending.set(requestId, {
      resolve: (result) => {
        cacheSet(hash, result);
        resolve(result);
      },
      reject,
    });
    getWorker().postMessage({ type: mode, config, requestId });
  });
}

// Cancel outdated requests for a specific bin
const activeBinRequests = new Map<string, string>(); // binId → requestId

export function requestBinMesh(
  binId: string,
  config: BinConfig,
  onMesh: Callback,
  onError?: ErrorCallback,
) {
  const hash = 'preview:' + configHash(config);
  const cached = cacheGet(hash);
  if (cached) {
    onMesh(cached);
    return;
  }

  // Cancel previous request for this bin
  const prev = activeBinRequests.get(binId);
  if (prev) pending.delete(prev);

  const requestId = `req_${++idCounter}`;
  activeBinRequests.set(binId, requestId);

  pending.set(requestId, {
    resolve: (result) => {
      cacheSet(hash, result);
      activeBinRequests.delete(binId);
      onMesh(result);
    },
    reject: (err) => {
      activeBinRequests.delete(binId);
      onError?.(err);
    },
  });

  getWorker().postMessage({ type: 'preview', config, requestId });
}

export function clearMeshCache() {
  meshCache.clear();
}
