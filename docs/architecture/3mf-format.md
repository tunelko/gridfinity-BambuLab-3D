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

The XML is packaged into a ZIP archive using JSZip with the required OPC structure:

```
layout.3mf (ZIP)
├── [Content_Types].xml
├── _rels/.rels
└── 3D/3dmodel.model
```

### 5. Download

The ZIP blob is offered as a browser download.

## Bambu Studio Compatibility

The exporter includes BambuStudio-specific metadata for object placement. Automated tests open the ZIP, read the XML, and reconstruct the mesh objects to check dimensions and fit after serialization. This does not certify behavior in every slicer version. Import at 100% scale and check the dimensions before printing; see [Print a Fit Test](/guide/fit-test).
