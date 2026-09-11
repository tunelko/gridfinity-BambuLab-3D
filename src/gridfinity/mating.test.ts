import { beforeAll, describe, expect, it } from 'vitest';
import Module, { type ManifoldToplevel } from 'manifold-3d';
import { generateBinExport, generateBinPreview, type BinConfig } from './binGeometry';
import { generateBaseplate } from './baseplateGeometry';

let wasm: ManifoldToplevel;
beforeAll(async () => { wasm = await Module(); wasm.setup(); });

const config: BinConfig = {
  w: 1, d: 1, h: 3, cornerRadius: 3.75,
  wallThickness: 1.2, bottomThickness: 0.8, stackingLip: true,
};

// Independent numeric oracle, transcribed from the community design drawing:
// https://gridfinity.xyz/assets/img/spec_draft_willtree8.jpg
// Do not import production SPEC or profile helpers into these calculations.
function socketWidth(z: number): number {
  if (z < 0.7) return 36.3 + 2 * z;
  if (z < 2.5) return 37.7;
  return 37.7 + 2 * (z - 2.5);
}

function opening(bin: any, z: number): any {
  const section = bin.slice(z);
  const polygons = section.toPolygons();
  section.delete();
  // The hole is the clockwise loop in the cross-section.
  const hole = polygons.find((p: number[][]) => p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0) < 0);
  expect(hole, `socket opening at z=${z}`).toBeDefined();
  return new wasm.CrossSection([...hole].reverse());
}

describe('independent stacking socket dimensions', () => {
  for (const generate of [generateBinExport, generateBinPreview]) {
    it(`${generate.name}: follows both chamfers and the 1.8mm straight band`, () => {
      const bin = generate(wasm, config);
      try {
        for (const z of [0.05, 0.35, 0.7, 1.5, 2.5, 2.8, 3.3, 3.6]) {
          const hole = opening(bin, 21 + z);
          try {
            const bounds = hole.bounds();
            expect(bounds.max[0] - bounds.min[0], `z=${z}`).toBeCloseTo(socketWidth(z), 3);
          } finally { hole.delete(); }
        }
      } finally { bin.delete(); }
    });
  }

  it('allows 0.20mm lateral displacement throughout insertion at nominal height', () => {
    const lower = generateBinExport(wasm, config);
    try {
      for (const lift of [0, 0.1, 0.5, 1, 2, 3, 4, 5]) {
        for (const [dx, dy] of [[0.2, 0], [0, -0.2]]) {
          const upper = lower.translate([dx, dy, 21 + lift]);
          const hit = lower.intersect(upper);
          try { expect(hit.volume(), `lift=${lift}`).toBeLessThan(0.001); }
          finally { hit.delete(); upper.delete(); }
        }
      }
    } finally { lower.delete(); }
  });
});

describe('baseplate compatibility and configurable bins', () => {
  it('keeps the requested lip and reported height even when a thick floor fills a 1u body', () => {
    const bin = generateBinExport(wasm, { ...config, h: 1, bottomThickness: 3 });
    try {
      expect(String(bin.status())).toBe('NoError');
      expect(bin.boundingBox().max[2]).toBeCloseTo(10.8, 4);
      const hole = opening(bin, 8.5);
      try { expect(hole.bounds().max[0] * 2).toBeCloseTo(37.7, 3); }
      finally { hole.delete(); }
    } finally { bin.delete(); }
  });

  it('a label shelf on a 1u bin never cuts into the mating foot or floor', () => {
    const plain = generateBinExport(wasm, { ...config, h: 1 });
    const labeled = generateBinExport(wasm, { ...config, h: 1, labelShelf: true, labelWidth: 12 });
    try {
      for (const z of [0.1, 0.8, 2.6, 4.7, 5.5]) {
        const a = plain.slice(z);
        const b = labeled.slice(z);
        try { expect(b.area(), `z=${z}`).toBeCloseTo(a.area(), 4); }
        finally { a.delete(); b.delete(); }
      }
    } finally { plain.delete(); labeled.delete(); }
  });

  it('a foot with a 0.15mm error envelope fits an independently built reference socket', () => {
    const bin = generateBinExport(wasm, config);
    try {
      for (let step = 1; step < 46; step++) {
        const z = step / 10;
        // Baseplate: same bottom/straight bands as the stacking socket,
        // but the upper chamfer continues to 42mm at z=4.65.
        const width = socketWidth(z);
        const radius = (width - 34) / 2;
        const core = wasm.CrossSection.square([34, 34], true);
        const reference = core.offset(radius, 'Round', 2, 128);
        const foot = bin.slice(z);
        const envelope = foot.offset(0.15, 'Round', 2, 128);
        const outside = envelope.subtract(reference);
        try { expect(outside.area(), `z=${z}`).toBeLessThan(0.0001); }
        finally { core.delete(); reference.delete(); foot.delete(); envelope.delete(); outside.delete(); }
      }
    } finally { bin.delete(); }
  });

  it('baseplate matches independently tabulated socket sections', () => {
    const plate = generateBaseplate(wasm, 1, 1);
    try {
      // Absolute heights include the 0.35mm relief below the socket profile.
      for (const [z, width] of [[0.1, 36.3], [0.7, 37], [1.5, 37.7], [3, 38], [4.7, 41.4]]) {
        const hole = opening(plate, z);
        const bounds = hole.bounds();
        expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(width, 3);
        hole.delete();
      }
      expect(String(plate.status())).toBe('NoError');
    } finally { plate.delete(); }
  });

  for (const [w, d] of [[1, 1], [2, 1], [2, 2], [3, 2]]) {
    it(`${w}x${d} feet seat on a baseplate, including square body corners`, () => {
      const plate = generateBaseplate(wasm, w, d);
      try {
        for (const cornerRadius of [0, 1.5, 3.75]) {
          const bin = generateBinExport(wasm, { ...config, w, d, cornerRadius });
          // Reference baseplate profile starts 0.35mm above its bed, not Z=0.
          const placed = bin.translate([0, 0, 0.35]);
          const hit = plate.intersect(placed);
          try { expect(hit.volume(), `cornerRadius=${cornerRadius}`).toBeLessThan(0.01); }
          finally { hit.delete(); placed.delete(); bin.delete(); }
        }
      } finally { plate.delete(); }
    });
  }

  it('keeps the socket independent of body radius and wall thickness', () => {
    for (const cornerRadius of [0, 1.5, 3.75]) {
      for (const wallThickness of [0.4, 1.2, 3]) {
        const bin = generateBinExport(wasm, { ...config, cornerRadius, wallThickness });
        const hole = opening(bin, 22.5);
        // Quarter-circle area catches sockets whose corners follow cosmetics.
        const expected = 37.7 ** 2 - (4 - Math.PI) * 1.85 ** 2;
        try { expect(hole.area()).toBeCloseTo(expected, 0); }
        finally { hole.delete(); bin.delete(); }
      }
    }
  });

  it('mixed sizes and enabled features enter without touching at the rim datum', () => {
    const lower = generateBinExport(wasm, { ...config, w: 2, d: 2, h: 2, labelShelf: true, dividersX: 1 });
    try {
      for (const [w, d, x, y] of [[1, 1, -21, -21], [2, 1, 0, 21], [2, 2, 0, 0]]) {
        const upper = generateBinExport(wasm, { ...config, w, d, magnets: true, screws: true });
        const placed = upper.translate([x, y, 14]);
        const hit = lower.intersect(placed);
        try { expect(hit.volume()).toBeLessThan(0.001); }
        finally { upper.delete(); placed.delete(); hit.delete(); }
      }
    } finally { lower.delete(); }
  });
});
