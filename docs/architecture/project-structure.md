# Project Structure

```
src/
├── main.tsx                     # Entry point
├── App.tsx                      # Layout: Toolbar + Sidebar + Canvas
│
├── store/
│   └── useStore.ts              # Zustand store (bins, grid, undo/redo, clipboard)
│
├── components/
│   ├── Toolbar.tsx              # Top bar: view modes, export, camera presets
│   ├── Sidebar.tsx              # Left panel: presets, bin list, BOM, tools,
│   │                            #   save/load, JSON export, Gist sharing
│   ├── GridCanvas2D.tsx         # 2D SVG grid with all interactions
│   ├── BinConfigurator.tsx      # Per-bin parameter editor (memo + debounce)
│   └── Viewport3D.tsx           # Three.js 3D preview (3 render modes)
│
├── gridfinity/
│   ├── constants.ts             # Gridfinity dimensions, presets, groups, templates
│   ├── spec.ts                  # Shared mating dimensions and total height
│   ├── binGeometry.ts           # Manifold CSG bin generation (preview + export)
│   ├── baseplateGeometry.ts     # Manifold CSG baseplate generation
│   ├── profiles.ts              # Rounded-ring profile lofts
│   ├── meshData.ts              # Validated mesh extraction in millimeters, Z-up
│   ├── fitKit.ts                # Two-bin + baseplate printable fit test
│   └── export3mf.ts             # 3MF packaging (JSZip + XML)
│
├── hooks/
│   └── useManifoldWorker.ts     # Web Worker interface hook
│
├── workers/
│   └── manifoldWorker.ts        # Background geometry generation
│
└── utils/
    ├── collision.ts             # AABB collision detection
    └── gridMath.ts              # Screen ↔ Grid coordinate math
```

## Key Modules

### State Management (`useStore.ts`)

Zustand store containing all application state:

- **Bins**: Array of bin objects with position, dimensions, features, and metadata
- **Grid**: Column/row count
- **Selection**: `selectedBinId` (primary) + `selectedBinIds` (multi-select)
- **Clipboard**: Copied bin configs with relative offsets
- **History**: Undo/redo stack (array of bin snapshots)
- **Drag state**: Mode tracking for placing, dragging, idle

### Geometry Engine (`binGeometry.ts`)

Two entry points:

- `generateBinPreview()` — Fast geometry for real-time 3D preview
- `generateBinExport()` — Higher curve resolution for 3MF export

Both use the same foot and socket profiles. `baseplateGeometry.ts` generates actual socket geometry for the preview and the printable fit test. WASM initialization lives in the worker; conversion to Three.js geometry lives in the viewport.

### 2D Grid (`GridCanvas2D.tsx`)

SVG-based canvas handling:

- Mouse interactions (click, drag, resize, rotate)
- Drop targets (drag from sidebar)
- Keyboard shortcuts
- All visual rendering (bins, ghosts, handles, measurements)

### 3D Viewport (`Viewport3D.tsx`)

Three.js scene management:

- 3 render modes (Solid, X-Ray, Blueprint)
- Camera presets with animation
- Section view with clipping plane
- Dimension labels overlay
