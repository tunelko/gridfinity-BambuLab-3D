# ZIP, 3MF and STL Export

Download a ZIP containing a complete 3MF model and one binary STL per part. Choose the printer, filament, and slicing settings in your slicer. The application does not generate toolpaths or send print jobs to a printer.

## How to Export

1. Design your layout on the 2D grid
2. Leave **ZIP (3MF + STL)** selected, or choose **3MF only** for a direct download
3. Click **Export All**, **Export Bin** for the selected bin, or **Fit Test**
4. Wait for generation and packaging; the download starts automatically
5. Extract a ZIP before importing `model.3mf` or the individual STL files

## Export Options

| Option | Description |
|--------|-------------|
| **Export Bin** | Exports only the currently selected bin |
| **Export All** | Exports all bins with their grid positions; one multi-object 3MF and one STL per bin in ZIP mode |
| **Fit Test** | Two small stackable bins and a 2×1 baseplate; works with an empty layout |

The workspace baseplate is excluded from **Export Bin** and **Export All**.
Neither section-view cuts, visual grid lines, colours, nor dimension labels are
exported as geometry or printer settings. **Fit Test** includes its own baseplate;
it does not export the entire preview grid.

## ZIP Contents

| Path | Contents |
|---|---|
| `model.3mf` | All exported parts in one multi-object model |
| `stl/001_Name.stl`, `stl/002_Name.stl`, … | One binary STL per part, with numbered, sanitized filenames |
| `README.txt` | Units, import instructions, and fit-check reminders |

Open the 3MF **or** the STL files, not both in the same print: they represent
the same geometry. The ZIP itself is a download container, not a slicer project.
Duplicate labels do not overwrite parts because every STL has a unique index.

Both formats use Z-up coordinates in millimetres and retain the same placement.
STL has no standard units, colour, object metadata, or printer profile; select
millimetres and **100% scale** on import. A slicer may recenter individual STLs.
Direct **3MF only** mode uses the same 3MF exporter without the outer ZIP or STLs.

## Validation and Compatibility

| Check | Current coverage |
|---|---|
| Generated solid | Nonempty, valid Manifold geometry before mesh extraction |
| Actual downloaded format | ZIP CRC checks, nested 3MF/XML checks, and real browser downloads for selected, all, fit-kit, and direct 3MF exports |
| Serialized geometry | Reconstructed solids are checked for connectivity, positive volume, dimensions, placement, and fit |
| Binary STL | Parsed independently with Three.js STLLoader; fit-kit meshes are rebuilt in Manifold and compared for volume, dimensions, connectivity, and placement |
| Units | Millimetres, Z up, checked in the export test |
| Independent format conformance | No XSD or independent 3MF validator currently runs |
| Slicer behaviour | No automated Bambu Studio, OrcaSlicer, PrusaSlicer, or Cura import test |
| Physical printer fit | Requires printing and measuring the fit kit |

The exporter includes Bambu Studio metadata, but metadata alone does not certify
slicer compatibility. Import at **100% scale**, check the number of objects and
their dimensions, choose your printer profile, and inspect the sliced toolpaths.
Then print the [fit test](../guide/fit-test.md) with your material. See the
[3MF structure](../architecture/3mf-format.md) for packaging details.
The [export verification record](../architecture/export-validation.md) provides
reproducible checks and their limitations.

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
4. Packaged with JSZip using the intended 3MF/OPC structure

### Fully Client-Side

Normal geometry generation and file packaging happen in your browser without
uploading the layout. The separate GitHub Gist sharing feature makes an external
upload only when explicitly requested; it is not part of model export.
