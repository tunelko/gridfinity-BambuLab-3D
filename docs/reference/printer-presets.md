# Printer Presets

Gridfinity Builder includes presets for popular 3D printers, automatically setting the grid size to match the printer's build plate.

## Available Presets

| Preset | Grid | Real Size | Notes |
|--------|------|-----------|-------|
| **Bambu Lab A1** | 6 x 6 | 252 x 252 mm | Default preset |
| **Bambu Lab A1 Mini** | 4 x 4 | 168 x 168 mm | Compact builds |
| **Bambu Lab P1S** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **Bambu Lab X1C** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **Bambu Lab X1E** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **Bambu Lab H2D** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **19" Server Rack** | 10 x 8 | 420 x 336 mm | Network equipment |
| **Custom** | Any | Any | Manual grid dimensions |

## Custom Grid Size

Set any grid size from 1x1 to 20x20 using the number inputs in the PRINTER / BASEPLATE section.

The real-world size is displayed automatically: `cols × 42mm` by `rows × 42mm`.

## Choosing a Preset

Click any preset button to instantly resize the grid. Bins that no longer fit within the new grid boundaries remain in place but may extend beyond the grid edge.

::: tip
If you change the grid size after placing bins, use **Optimize Layout** to automatically repack all bins into the smallest possible grid.
:::
