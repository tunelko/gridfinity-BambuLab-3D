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
| Total height | H × 7mm + 4.75mm | 25.75 mm |
| Inner width | Outer - 2 × wall | 81.1 mm |
| Inner depth | Outer - 2 × wall | 81.1 mm |

## Z-Profile Base

The Gridfinity base uses a stepped chamfer profile with 5 layers for interlocking with the baseplate:

```
Layer 5: Full bin footprint (main body)
Layer 4: Chamfer transition
Layer 3: Intermediate step
Layer 2: Chamfer transition
Layer 1: Narrow foot (bottom contact)
```

This profile allows bins to snap into baseplates securely while remaining easy to remove.

## Magnet Holes

Magnet holes are placed at the corners of each cell unit within a bin. Shared internal corners are deduplicated to avoid overlapping holes.

The inset from the bin edge is dynamic: `max(8.0mm, cornerRadius + holeRadius + 1.0mm)`.

## Stacking Lip

The stacking lip adds a 4.4mm rim at the top of the bin that mirrors the baseplate socket profile, allowing bins to be stacked on top of each other.

## Resources

- [Gridfinity Official Site](https://gridfinity.xyz)
- [Gridfinity Specification](https://gridfinity.xyz/specification/)
- [Zack Freedman's YouTube](https://www.youtube.com/@ZackFreedman)
