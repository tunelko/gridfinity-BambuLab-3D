# Geometry Pipeline

The geometry pipeline converts user configurations into renderable 3D meshes and exportable 3MF files.

## Data Flow

```
User changes bin config
  → Zustand store updates
  → Web Worker receives config
  → Manifold WASM generates CSG mesh
  → Mesh transferred back to main thread
  → Converted to Three.js BufferGeometry
  → 3D viewport updates in real-time
```

## Web Worker

Heavy CSG operations run in a **Web Worker** (`manifoldWorker.ts`) to keep the UI thread responsive. The worker:

1. Initializes the Manifold WASM module once, sharing an initialization promise across concurrent requests
2. Receives bin or baseplate configurations via `postMessage`
3. Runs CSG operations (boolean subtract, add)
4. Rejects empty or invalid solids, extracts XYZ positions and triangle indices, and transfers the arrays to the main thread

### Caching

Generated meshes are cached by mode and configuration in a bounded LRU cache. A new preview request cancels an older pending result for that bin, even when the new configuration is cached. The viewport clones cached arrays before its Y↔Z coordinate swap; exports keep Z-up coordinates.

## Coordinate Systems

| System | Up Axis | Used By |
|--------|---------|---------|
| Manifold | Z-up | CSG operations |
| Three.js | Y-up | 3D rendering |
| 3MF | Z-up | Export files |

When converting from Manifold to Three.js:
1. Swap Y and Z vertex coordinates
2. Reverse triangle winding order (to fix normals)

## Performance

- **One geometry for preview and export**: what you see is what you print (feet,
  stacking lip, chamfers). Preview uses coarser curve tessellation for speed;
  export renders full resolution.
- **Web Worker**: all CSG (preview and 3MF export) runs off the main thread
- **Mesh caching**: avoids redundant CSG operations

## Fit Verification

`mating.test.ts` compares cross-sections against independent numerical reference dimensions and checks bin/baseplate intersections. `export3mf.test.ts` reconstructs the three fit-kit solids from the serialized archive and checks dimensions, connectivity, placement, and assembled interference. These checks do not replace a physical print or a slicer smoke test. See [Print a Fit Test](/guide/fit-test).

The [change verification record](./fit-validation.md) records commands, browser scenarios, rollback boundaries, and remaining validation limits.
