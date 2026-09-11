import { GF } from './constants';
import type { BinConfig } from './binGeometry';
import type { MeshData } from './meshData';

/** Small print: two identical 1u bins and a 2×1 open baseplate, side by side. */
export async function createFitKit(request: {
  bin: (config: BinConfig) => Promise<MeshData>;
  plate: (config: { w: number; d: number }) => Promise<MeshData>;
}) {
  const bin = await request.bin({
    w: 1, d: 1, h: 1, stackingLip: true,
    cornerRadius: GF.BIN_CORNER_RADIUS,
    wallThickness: GF.WALL_THICKNESS, bottomThickness: GF.BOTTOM_THICKNESS,
  });
  const plate = await request.plate({ w: 2, d: 1 });
  return [
    { data: bin, name: 'Fit_bin_A_1x1x1u', x: -25, y: -25 },
    { data: bin, name: 'Fit_bin_B_1x1x1u', x: 25, y: -25 },
    { data: plate, name: 'Fit_baseplate_2x1', x: 0, y: 25 },
  ].map(({ data, name, x, y }) => {
    const vertices = new Float32Array(data.positions);
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i] += x;
      vertices[i + 1] += y;
    }
    return { name, mesh: { vertices, triangles: new Uint32Array(data.indices) } };
  });
}
