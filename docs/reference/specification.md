# Gridfinity Specification

This tool implements the [official Gridfinity specification](https://gridfinity.xyz/specification/).

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
| Stacking lip | 4.4 mm | Lip height that mirrors socket profile |
| Magnet holes | 6mm dia, 2mm deep | For magnet retention |
| Screw holes | M3 (3.2mm clearance) | For screw retention |

## Bin Dimensions Formula

For a bin of size **W x D x H** (in grid units):

| Measurement | Formula | Example (2x2x3u) |
|-------------|---------|-------------------|
| Outer width | W × 42mm - 0.5mm | 83.5 mm |
| Outer depth | D × 42mm - 0.5mm | 83.5 mm |
| Total height | H × 7mm (base included) | 21.00 mm |
| Stacking lip | +4.4mm above the rim (optional) | 25.40 mm |
| Inner width | Outer - 2 × wall | 81.1 mm |
| Inner depth | Outer - 2 × wall | 81.1 mm |

## Z-Profile Base

Each cell has a foot following the official Gridfinity profile (45° chamfers), bottom to top:

```
z 0.00 → 0.80   45° chamfer   width 35.60 → 37.20 mm
z 0.80 → 2.60   vertical      width 37.20 mm
z 2.60 → 4.75   45° chamfer   width 37.20 → 41.50 mm
```

The foot corner radius follows the inset (3.75mm at the top, 0.80mm at the bottom), so bins
self-center and seat flush in any standard baseplate. Multi-cell bins have one foot per cell
with the spec 0.5mm V-groove between them.

## Magnet Holes

Magnet hole centers form the official **26 × 26 mm square centered in each cell**
(13mm from the cell center), matching magnetized baseplates. The standard hole is
⌀6.5 × 2.4mm (6×2mm magnet + press-fit clearance); custom magnet sizes adjust the
hole while keeping the 26mm grid.

## Stacking Lip

The stacking lip is a 4.4mm **protrusion above the top rim** whose inner surface is the
negative of the foot profile (45° seat + vertical section + support chamfer, insets
0.7 / 1.9 / 2.15mm). A stacked bin's feet drop in, self-center on the 45° seat and
nest ~4mm deep, resting 0.35mm above the rim. Stacking is verified by automated
mating tests (seat contact, lateral lock, insertion clearance).

## Resources

- [Gridfinity Official Site](https://gridfinity.xyz)
- [Gridfinity Specification](https://gridfinity.xyz/specification/)
- [Zack Freedman's YouTube](https://www.youtube.com/@ZackFreedman)
