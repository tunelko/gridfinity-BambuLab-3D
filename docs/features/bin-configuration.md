# Bin Configuration

Click any bin on the 2D grid or in the sidebar list to select it and open the configurator panel.

![Bin Configurator](/images/bin-config.png)

## Parameters

### Dimensions

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Width (W) | 1–10 | 1 | Width in grid units (42mm each) |
| Depth (D) | 1–10 | 1 | Depth in grid units |
| Height (H) | 1–12 | 3 | Height units (7mm each) |

### Geometry

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Corner radius | 0–3.75 mm | 3.75 mm | Body only; feet and sockets retain fixed mating radii |
| Wall thickness | 0.4–3.0 mm | 1.2 mm | Outer wall thickness |
| Bottom thickness | 0.4–3.0 mm | 0.8 mm | Floor thickness |

### Features

| Feature | Description |
|---------|-------------|
| **Stacking lip** | +3.8mm printed rim with its own female mating profile |
| **Label shelf** | 45-degree angled shelf on the front wall for label strips |
| **Label width** | Requested shelf width; limited by cavity height to protect the floor and feet on shallow bins |
| **Magnets** | 6mm diameter holes at corners for magnet retention (4 per cell unit) |
| **Screws** | M3 clearance holes at corners for screw retention (4 per cell unit) |
| **Dividers X** | Vertical dividers (0–9), equispaced wall-to-wall |
| **Dividers Y** | Horizontal dividers (0–9), equispaced wall-to-wall |

### Appearance

| Parameter | Description |
|-----------|-------------|
| **Color** | Bin color (affects 2D grid display and 3D preview) |
| **Label** | Text label displayed on the bin in the 2D grid |
| **Group** | Assign to a group for organization (Screws, Tools, Cables, etc.) |

## Real-World Dimensions

The configurator shows computed real-world dimensions:

- **Outer size**: `W × 42mm - 0.5mm tolerance` per axis
- **Total height**: `H × 7mm + (stacking lip ? 3.8mm : 0)`; the base is included

For example, a 2x2x3u bin measures **83.5 × 83.5 × 21.0mm**, or **24.8mm high**
with a stacking lip. Check the [fit test](../guide/fit-test.md) before a full print.
