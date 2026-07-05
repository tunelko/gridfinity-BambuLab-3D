import { beforeAll, describe, expect, it } from 'vitest';
import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
import { GF } from './constants';
import { SPEC } from './spec';
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

// ── F1: official foot Z-profile (export geometry) ───────────────────────────
//
//   z 0.00→0.80  45° chamfer  35.60 → 37.20
//   z 0.80→2.60  vertical     37.20
//   z 2.60→4.75  45° chamfer  37.20 → 41.50

describe('official foot Z-profile', () => {
  let bin: any;

  beforeAll(() => {
    bin = generateBinExport(wasm, baseConfig());
  });

  function widthAt(z: number): number {
    const cs = bin.slice(z);
    const b = cs.bounds();
    const w = b.max[0] - b.min[0];
    cs.delete();
    return w;
  }

  it('bottom chamfer: ~35.6mm at z≈0', () => {
    expect(widthAt(0.02)).toBeCloseTo(35.6 + 2 * 0.02, 1);
  });

  it('vertical section: 37.2mm at z=1.5', () => {
    expect(widthAt(1.5)).toBeCloseTo(37.2, 2);
  });

  it('top chamfer at 45°: ~39.35mm at z=3.675', () => {
    expect(Math.abs(widthAt(3.675) - 39.35)).toBeLessThan(0.08);
  });

  it('foot reaches full 41.5mm cell width at the top', () => {
    expect(Math.abs(widthAt(4.70) - 41.4)).toBeLessThan(0.08);
    expect(widthAt(6.0)).toBeCloseTo(41.5, 2); // body above
  });

  it('foot corners keep the spec radius (not proportionally scaled)', () => {
    // At z=4.70 the inset is 0.05 → spec corner r = 3.70.
    // area = w² − (4−π)·r². A scaled-extrude foot would have r≈1.78 (+9mm²).
    const cs = bin.slice(4.70);
    const b = cs.bounds();
    const w = b.max[0] - b.min[0];
    const expected = w * w - (4 - Math.PI) * 3.70 * 3.70;
    expect(Math.abs(cs.area() - expected)).toBeLessThan(3);
    cs.delete();
  });

  it('multi-cell: per-cell feet with 0.5mm V-grooves between cells', () => {
    const twoWide = generateBinExport(wasm, baseConfig({ w: 2 }));
    try {
      const cs = twoWide.slice(1.5); // vertical section: 37.2 per cell, 42 pitch
      const bnd = cs.bounds();
      expect(bnd.max[0] - bnd.min[0]).toBeCloseTo(42 + 37.2, 1);
      cs.delete();
    } finally {
      twoWide.delete();
    }
  });
});

describe('magnet holes on the official 26mm grid', () => {
  // Probe just inside the rim of a hole centered at (13,13): only empty if
  // the hole center is at the spec 13mm offset (a 12.75mm-offset hole ends
  // at x=16.0 and leaves this probe solid).
  function probeVolume(target: any): number {
    const probe = wasm.Manifold.cube([0.06, 0.4, 0.5]).translate([16.15, 12.8, 0.5]);
    const hit = target.intersect(probe);
    const v = hit.volume();
    probe.delete();
    hit.delete();
    return v;
  }

  it('hole rim sits at 13 + r from the cell center', () => {
    const withMagnets = generateBinExport(wasm, baseConfig({ magnets: true }));
    try {
      expect(probeVolume(withMagnets)).toBeLessThan(1e-6);
    } finally {
      withMagnets.delete();
    }
  }, 120_000);

  it('same spot is solid without magnets', () => {
    const solid = generateBinExport(wasm, baseConfig());
    try {
      expect(probeVolume(solid)).toBeGreaterThan(0.01);
    } finally {
      solid.delete();
    }
  }, 120_000);
});

// ── F2: stacking — two identical bins must physically mate ──────────────────
//
// Seated position: the foot's 2.15 top chamfer rests full-face on the lip's
// 45° seat, leaving the foot bottom 0.35mm above the rim (rim = u×7).

describe('stacking: two identical bins mate', () => {
  const config = baseConfig({ w: 2, d: 2, h: 3, stackingLip: true });
  const seatZ = 3 * GF.HEIGHT_UNIT + 0.35;
  let bottom: any;

  beforeAll(() => {
    bottom = generateBinExport(wasm, config);
  }, 120_000);

  function overlapAt(dx: number, dy: number, dz: number): number {
    const top = bottom.translate([dx, dy, dz]);
    const inter = bottom.intersect(top);
    const v = inter.volume();
    top.delete();
    inter.delete();
    return v;
  }

  it('no interpenetration at the seated position', () => {
    expect(overlapAt(0, 0, seatZ)).toBeLessThan(0.01);
  }, 120_000);

  it('actually rests there: 0.3mm lower collides with the seat', () => {
    expect(overlapAt(0, 0, seatZ - 0.3)).toBeGreaterThan(0.5);
  }, 120_000);

  it('laterally locked: 1mm sideways collides with the lip', () => {
    expect(overlapAt(1, 0, seatZ)).toBeGreaterThan(0.5);
    expect(overlapAt(0, 1, seatZ)).toBeGreaterThan(0.5);
  }, 120_000);

  it('mouth guides an off-center bin down the 45° seat', () => {
    // A bin off-center by s can descend to lift ≈ s along the guided path
    // (contact-sliding on the seat); verify a 0.2mm-off bin fits at the
    // corresponding height with margin. Descending further, the seat forces
    // it to center — that is the self-centering insertion.
    expect(overlapAt(0.2, 0, seatZ + 2.1)).toBeLessThan(0.01);
  }, 120_000);
});

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

          // Spec heights: total = u×7 (base included); the lip protrudes 4.4 above.
          const expectedTop =
            config.h * GF.HEIGHT_UNIT + (config.stackingLip ? SPEC.LIP.HEIGHT : 0);
          expect(bb.max[2]).toBeCloseTo(expectedTop, 1);

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
