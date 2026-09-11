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
| **Fit Test** | Two small stackable bins and a 2×1 baseplate; works with an empty layout |

## Slicer Compatibility

![Bambu Studio](/images/bambulabA1.png)

The exporter includes metadata intended for:

- **Bambu Studio** — BambuStudio-specific metadata
- **PrusaSlicer** and **Cura** — Standard 3MF mesh import

Automated validation reconstructs the meshes from the generated ZIP/XML. It does
not launch these slicers. Verify the imported dimensions and print the
[fit test](../guide/fit-test.md) with your slicer and material.

## Technical Details

### Manifold CSG

Geometry is generated using the [Manifold](https://github.com/elalish/manifold) WASM CSG engine:

- **Closed meshes** — Nonempty, valid solids are required before extracting mesh buffers
- **Boolean operations** — Cavities, holes and features are combined in the CAD model
- **Performance** — CSG runs in a Web Worker to keep the UI responsive

### 3MF Format

The 3MF format is a ZIP archive (OPC package) containing XML mesh data:

1. Vertices and triangles extracted from Manifold meshes
2. Preserve Z-up coordinates in millimeters (Y/Z conversion is only for the preview)
3. Serialized to 3MF XML with proper namespaces
4. Packaged with JSZip as a valid OPC archive

### Fully Client-Side

All geometry generation and file packaging happens in your browser. No data is sent to any server.
