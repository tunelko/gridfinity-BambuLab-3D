# 3MF Format

Gridfinity Builder exports bins in the [3MF format](https://3mf.io/), an industry-standard 3D printing file format.

## What is 3MF?

3MF (3D Manufacturing Format) is a ZIP archive (OPC package) containing XML mesh data. It was designed to replace STL with a richer, more reliable format.

## Export Process

### 1. Generate Meshes

For each bin, the full export geometry is generated with:

- Exact lower chamfer, straight band, and upper chamfer of the mating foot
- All features (magnets, screws, dividers, lip, label shelf)
- Watertight boolean operations via Manifold CSG

### 2. Position on Grid

Each bin's vertices are offset by its grid position:

```
vertex.x += (bin.x + bin.w / 2) × 42mm - gridCols × 42mm / 2
vertex.y += (bin.y + bin.d / 2) × 42mm - gridRows × 42mm / 2
```

The bin's lowest Z stays at zero. Fit Test uses its own non-overlapping three-object placement so the bins and baseplate can be printed together, not assembled on the print bed.

### 3. Serialize to XML

The exporter creates the 3MF XML structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" />
          ...
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
          ...
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>
```

### 4. Package as ZIP

The XML is packaged into a ZIP archive using JSZip. The exporter currently writes:

```
layout.3mf (ZIP)
├── [Content_Types].xml
├── _rels/.rels
├── 3D/3dmodel.model
└── Metadata/
    ├── model_settings.config
    ├── project_settings.config
    └── slice_info.config
```

### 5. Download

With **3MF only**, this archive is downloaded directly as a `.3mf` file. The
default **ZIP (3MF + STL)** option wraps it as `model.3mf` alongside one binary
STL per part and import instructions. This outer ZIP is not an OPC/3MF package:
extract it before opening a model. See [export options](../features/export.md).

## Bambu Studio Compatibility

The exporter includes BambuStudio-specific metadata. Placement is baked into
the vertices: the exported build items do not add another placement transform.
For each mesh, the file includes a volume object and a parent component object;
the build references the parent. The production-extension UUIDs are written on
objects, component references, and build items.

`src/gridfinity/export3mf.test.ts` opens the generated ZIP, reads the XML, and
reconstructs the mesh objects to check dimensions, connectivity, volume, placement,
and mating after serialization. This is a focused mesh round-trip test, not a
complete XML/schema or OPC conformance validator. It does not launch a slicer.

No printer profile or sliced toolpaths are supplied. Import at 100% scale,
choose your machine and filament settings, and check dimensions before printing;
see [Print a Fit Test](/guide/fit-test).
