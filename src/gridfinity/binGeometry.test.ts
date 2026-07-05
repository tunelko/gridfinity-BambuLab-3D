import { beforeAll, describe, expect, it } from 'vitest';
import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
import { GF } from './constants';
import { generateBinExport, generateBinPreview, type BinConfig } from './binGeometry';

let wasm: ManifoldToplevel;

beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
}, 60_000);

const EPS = 0.01;

function baseConfig(overrides: Partial<BinConfig> = {}): BinConfig {
  return {
    w: 1, d: 1, h: 3,
    cornerRadius: GF.BIN_CORNER_RADIUS,
    wallThickness: GF.WALL_THICKNESS,
    bottomThickness: GF.BOTTOM_THICKNESS,
    magnets: false, screws: false, stackingLip: false,
    labelShelf: false, labelWidth: GF.LABEL_DEFAULT_WIDTH,
    dividersX: 0, dividersY: 0,
    ...overrides,
  };
}

/** Rebuild a Manifold from the raw mesh buffers exactly as export3mf writes them. */
function meshRoundtrip(manifold: any): any {
  const mesh = manifold.getMesh();
  return new wasm.Manifold(new wasm.Mesh({
    numProp: 3,
    vertProperties: mesh.vertProperties,
    triVerts: mesh.triVerts,
  }));
}

interface Case { name: string; config: BinConfig }

const CASES: Case[] = [
  { name: '1x1x3 plain', config: baseConfig() },
  {
    name: '2x2x6 full-featured',
    config: baseConfig({
      w: 2, d: 2, h: 6,
      magnets: true, screws: true, stackingLip: true,
      labelShelf: true, dividersX: 2, dividersY: 1,
    }),
  },
  { name: '3x2x2 dividers', config: baseConfig({ w: 3, d: 2, h: 2, dividersX: 3, dividersY: 2 }) },
];

for (const generator of [generateBinExport, generateBinPreview] as const) {
  const mode = generator === generateBinExport ? 'export' : 'preview';

  describe(`${mode} geometry invariants`, () => {
    for (const { name, config } of CASES) {
      it(`${name}: manifold, watertight, correct footprint`, () => {
        const bin = generator(wasm, config);
        try {
          expect(bin.isEmpty()).toBe(false);
          expect(String(bin.status())).toBe('NoError');
          expect(bin.genus()).toBeGreaterThanOrEqual(0);
          expect(bin.volume()).toBeGreaterThan(0);

          // Footprint must be exactly W×42−0.5 × D×42−0.5 (Gridfinity 41.5 per cell)
          const bb = bin.boundingBox();
          expect(bb.max[0] - bb.min[0]).toBeCloseTo(config.w * GF.CELL_SIZE - GF.TOLERANCE, 2);
          expect(bb.max[1] - bb.min[1]).toBeCloseTo(config.d * GF.CELL_SIZE - GF.TOLERANCE, 2);
          expect(bb.min[2]).toBeCloseTo(0, 2);

          // Height: current formula base + h×7. NOTE: changes in F2 (spec heights u×7 total).
          const expectedTop = GF.BASE_TOTAL_HEIGHT + config.h * GF.HEIGHT_UNIT;
          expect(bb.max[2]).toBeGreaterThan(GF.BASE_TOTAL_HEIGHT);
          expect(bb.max[2]).toBeLessThanOrEqual(expectedTop + EPS);

          // The exact mesh buffers written to the 3MF must themselves be manifold
          const rebuilt = meshRoundtrip(bin);
          try {
            expect(String(rebuilt.status())).toBe('NoError');
            expect(rebuilt.volume()).toBeCloseTo(bin.volume(), 1);
          } finally {
            rebuilt.delete();
          }
        } finally {
          bin.delete();
        }
      }, 120_000);
    }

    it('magnet holes remove material', () => {
      const solid = generator(wasm, baseConfig());
      const withMagnets = generator(wasm, baseConfig({ magnets: true }));
      try {
        expect(withMagnets.volume()).toBeLessThan(solid.volume());
      } finally {
        solid.delete();
        withMagnets.delete();
      }
    }, 120_000);

    it('screw holes remove material', () => {
      const solid = generator(wasm, baseConfig());
      const withScrews = generator(wasm, baseConfig({ screws: true }));
      try {
        expect(withScrews.volume()).toBeLessThan(solid.volume());
      } finally {
        solid.delete();
        withScrews.delete();
      }
    }, 120_000);

    it('dividers add material', () => {
      const plain = generator(wasm, baseConfig());
      const divided = generator(wasm, baseConfig({ dividersX: 2, dividersY: 2 }));
      try {
        expect(divided.volume()).toBeGreaterThan(plain.volume());
      } finally {
        plain.delete();
        divided.delete();
      }
    }, 120_000);
  });
}
