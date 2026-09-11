# Gridfinity Specification

This tool targets the [community Gridfinity design reference](https://gridfinity.xyz/specification/),
cross-checked against [Gridfinity Rebuilt](https://github.com/kennetek/gridfinity-rebuilt-openscad/blob/main/src/core/standard.scad).
The reference is a draft, not a compatibility certification. Start with the
[fit test](../guide/fit-test.md) before printing a large layout.

## Core Dimensions

| Dimension | Value | Description |
|-----------|-------|-------------|
| Cell size | 42 x 42 mm | Base unit of the grid |
| Height unit | 7 mm | One "u" of bin height |
| Tolerance | 0.5 mm | Total clearance (0.25mm per side) |
| Bin corner radius | 3.75 mm | Standard rounded corners |
| Base height | 4.75 mm | Z-profile base total height |
| Wall thickness | 1.2 mm | Default outer wall |
| Bottom thickness | 0.8 mm | Default floor |
| Stacking lip | 3.8 mm printed | 4.4mm theoretical profile with a 0.6mm tip trim |
| Magnet holes | 6.5mm dia, 2.4mm deep | For nominal 6×2mm magnets |
| Basic baseplate | 5 mm | Open-bottom sockets, no mounting hardware |
| Screw holes | M3 (3.2mm clearance) | For screw retention |

## Bin Dimensions Formula

For a bin of size **W x D x H** (in grid units):

| Measurement | Formula | Example (2x2x3u) |
|-------------|---------|-------------------|
| Outer width | W × 42mm - 0.5mm | 83.5 mm |
| Outer depth | D × 42mm - 0.5mm | 83.5 mm |
| Total height | H × 7mm (base included) | 21.00 mm |
| With stacking lip | H × 7mm + 3.8mm | 24.80 mm |
| Inner width | Outer - 2 × wall | 81.1 mm |
| Inner depth | Outer - 2 × wall | 81.1 mm |

## Z-Profile Base

Each cell has a foot following the reference profile (45° chamfers), bottom to top:

```
z 0.00 → 0.80   45° chamfer   width 35.60 → 37.20 mm
z 0.80 → 2.60   vertical      width 37.20 mm
z 2.60 → 4.75   45° chamfer   width 37.20 → 41.50 mm
```

The foot corner radius follows the inset (3.75mm at the top, 0.80mm at the bottom), so bins
retain concentric mating corners. Multi-cell bins have one foot per cell at 42mm pitch,
with a 0.5mm gap at the top of adjacent feet. Body corner customization does not change feet or sockets.

## Magnet Holes

Standard magnet hole centers form a **26 × 26 mm square centered in each cell**
(13mm from the cell center), matching magnetized baseplates. The standard hole is
⌀6.5 × 2.4mm (6×2mm magnet + press-fit clearance); custom magnet sizes adjust the
hole dimensions. Oversized custom magnets can move the centers inward to preserve
material at the foot edge, so they do not necessarily align with standard magnetized bases.

## Stacking Lip

The female socket has a separate profile from the foot. Heights below are relative
to the nominal rim, `H × 7mm`; widths are for a 1×1 bin.

| Height | Opening width | Corner radius |
|---|---|---|
| 0.0 mm | 36.3 mm | 1.15 mm |
| 0.7 mm | 37.7 mm | 1.85 mm |
| 2.5 mm | 37.7 mm | 1.85 mm |
| 3.8 mm, printed crown | 40.3 mm | 3.15 mm |
| 4.4 mm, theoretical tip | 41.5 mm | 3.75 mm |

The first and last bands are 45° chamfers, with a 1.8mm vertical band between them.
The top 0.6mm is trimmed to avoid an unprintable knife edge. A separate support
under the rim connects the lip to the body wall.

With the upper foot bottom at the nominal rim, lateral clearance is 0.25mm per side
in the straight band and 0.35mm in the chamfer bands. Ideal default bins can descend
another 0.35mm to contact the inclined seat. Contact at rest is intentional;
positive clearance is checked during insertion. Thick walls and internal features
can affect the final resting height below the nominal rim.

## Baseplate Socket

The basic baseplate uses a 42mm outline and 4mm corner radius. Its opening is 36.3mm
at the bottom, 37.7mm in the straight band, and 42mm at the top. Its profile is
`0.7 + 1.8 + 2.15 = 4.65mm` high, with 0.35mm of relief below it in the 5mm plate.
The bin foot datum is aligned with that 0.35mm relief for insertion checks.

Automated checks use independently tabulated sections, a 0.15mm expanded foot
envelope, multiple bin sizes, and meshes reconstructed from the actual 3MF ZIP/XML.
These verify nominal geometry; they cannot measure printer calibration or warping.

## Resources

- [Gridfinity Community Site](https://gridfinity.xyz)
- [Gridfinity Specification](https://gridfinity.xyz/specification/)
- [Zack Freedman's YouTube](https://www.youtube.com/@ZackFreedman)
