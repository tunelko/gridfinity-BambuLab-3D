# CSG Algorithm

Each Gridfinity bin is built through a series of **Constructive Solid Geometry** boolean operations using the [Manifold](https://github.com/elalish/manifold) WASM engine.

## Build Steps

### 1. Outer Shell

Start with a **rounded box** matching the bin's outer dimensions:

- Width: `W × 42mm - 0.5mm`
- Depth: `D × 42mm - 0.5mm`
- Height: `H × 7mm + 4.75mm`
- Corner radius: configurable (default 3.75mm)

### 2. Inner Cavity

Create a slightly smaller rounded box and **subtract** it from the outer shell:

- Offset inward by `wallThickness` on X and Y
- Offset upward by `bottomThickness + baseHeight` on Z
- This creates the walls and floor of the bin

### 3. Base Profile

Add the stepped Z-profile for baseplate interlocking:

- Create a 2D cross-section polygon (CCW winding)
- Revolve or extrude to create the 3D profile
- **Add** to the bottom of the bin

For export, the base uses a full 5-layer stepped profile. For preview, a flat simplified base is used for performance.

### 4. Features

Apply optional features via additional boolean operations:

| Feature | Operation |
|---------|-----------|
| **Magnet holes** | Subtract cylinders at corner positions |
| **Screw holes** | Subtract cylinders at corner positions |
| **Dividers** | Add thin wall boxes inside the cavity |
| **Stacking lip** | Add rim profile at the top edge |
| **Label shelf** | Add 45-degree wedge, subtract from front wall |

## Manifold API Notes

- `CrossSection` accepts `[number, number][]` polygons with **CCW winding**
- `.extrude()`, `.subtract()`, `.add()` return new objects — originals must be `.delete()`'d
- WASM objects have **no garbage collection** — manual `.delete()` is required
- `getMesh()` returns `{ vertProperties, triVerts, numProp, numVert }` with stride = numProp

## Magnet Hole Placement

Magnet holes are placed at the corners of each **cell unit** within a multi-cell bin. Shared internal corners (where cells meet) are deduplicated to avoid overlapping holes.

The inset distance from the bin edge is computed dynamically:

```
inset = max(8.0mm, cornerRadius + holeRadius + 1.0mm)
```

This ensures holes don't cut into the rounded corners.
