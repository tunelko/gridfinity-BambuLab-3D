# 3MF Export

Export your designs as industry-standard 3MF files, ready for slicing and 3D printing.

## How to Export

1. Design your layout on the 2D grid
2. Click **"Export All 3MF"** in the toolbar (or export a single bin)
3. A progress bar shows the generation status
4. The file downloads automatically when ready

## Export Options

| Option | Description |
|--------|-------------|
| **Export Single** | Exports only the currently selected bin |
| **Export All** | Exports all bins as a multi-object 3MF with correct grid positions |

## Slicer Compatibility

![Bambu Studio](/images/bambulabA1.png)

Exported 3MF files are tested with:

- **Bambu Studio** — Full compatibility with BambuStudio-specific metadata
- **PrusaSlicer** — Opens and slices correctly
- **Cura** — Standard 3MF support

## Technical Details

### Manifold CSG

All geometry is generated using the [Manifold](https://github.com/elalish/manifold) WASM CSG engine, which guarantees:

- **Watertight meshes** — No holes or self-intersections
- **Boolean correctness** — Subtraction operations (cavities, holes) are mathematically exact
- **Performance** — CSG runs in a Web Worker to keep the UI responsive

### 3MF Format

The 3MF format is a ZIP archive (OPC package) containing XML mesh data:

1. Vertices and triangles extracted from Manifold meshes
2. Coordinate system conversion (Manifold Z-up to 3MF Y-up)
3. Serialized to 3MF XML with proper namespaces
4. Packaged with JSZip as a valid OPC archive

### Fully Client-Side

All geometry generation and file packaging happens in your browser. No data is sent to any server.
