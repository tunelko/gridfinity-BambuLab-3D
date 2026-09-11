import { afterEach, expect, it, vi } from 'vitest';
import type { BinConfig } from '../gridfinity/binGeometry';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('a cached preview cancels an older in-flight result for the same bin', async () => {
  const messages: { requestId: string }[] = [];
  let respond: (id: string, value: number) => void;
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void;
    constructor() {
      respond = (requestId, value) => this.onmessage?.({ data: {
        type: 'mesh', requestId, positions: new Float32Array([value]), indices: new Uint32Array(),
      } });
    }
    postMessage(message: { requestId: string }) { messages.push(message); }
  });
  const { requestBinMesh } = await import('./useManifoldWorker');
  const config: BinConfig = { w: 1, d: 1, h: 3, cornerRadius: 3.75, wallThickness: 1.2, bottomThickness: 0.8 };
  const onMesh = vi.fn();
  requestBinMesh('bin', config, onMesh);
  respond!(messages[0].requestId, 1);
  requestBinMesh('bin', { ...config, h: 4 }, onMesh);
  requestBinMesh('bin', config, onMesh);
  respond!(messages[1].requestId, 2);
  expect(messages).toHaveLength(2);
  expect(onMesh).toHaveBeenCalledTimes(2);
  expect(onMesh.mock.lastCall?.[0].positions[0]).toBe(1);
});
