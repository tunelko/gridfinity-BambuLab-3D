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

1. Initializes the Manifold WASM module on first call
2. Receives bin configurations via `postMessage`
3. Runs CSG operations (boolean subtract, add)
4. Returns the resulting mesh data (`vertProperties`, `triVerts`)

### Caching

Generated meshes are cached by a hash of the bin configuration. When a bin's config changes, only that bin's geometry is regenerated. The cache uses `Float32Array` cloning to avoid mutation issues during the Y↔Z coordinate swap.

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

- **Preview geometry**: Simplified base profile (flat) for fast rendering
- **Export geometry**: Full 5-layer Z-profile base for accurate printing
- **Web Worker**: Non-blocking CSG prevents UI freezes
- **Mesh caching**: Avoids redundant CSG operations
