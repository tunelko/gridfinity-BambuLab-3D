# Printer Presets

These are layout-grid shortcuts stored in the application, not slicer or printer
profiles. Selecting a name changes the grid dimensions only: it does not configure
nozzle size, filament, temperatures, printable height, exclusion zones, or toolpaths.

## Available Presets

| Preset | Grid | Real Size | Notes |
|--------|------|-----------|-------|
| **Bambu Lab A1** | 6 x 6 | 252 x 252 mm | Default layout grid |
| **Bambu Lab A1 Mini** | 4 x 4 | 168 x 168 mm | Compact builds |
| **Bambu Lab P1S** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **Bambu Lab X1C** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **Bambu Lab X1E** | 6 x 6 | 252 x 252 mm | Same as A1 |
| **Bambu Lab H2D** | 6 x 6 | 252 x 252 mm | Current app shortcut; not a statement of the machine's full build volume |
| **19" Server Rack** | 10 x 8 | 420 x 336 mm | Network equipment |
| **Custom** | 8 x 8 initially | 336 x 336 mm | Starting grid; edit the dimensions afterwards |

The dimensions above are grid extents, not manufacturer build-volume specifications.
Check the exported arrangement against your actual slicer profile, bed boundaries,
brim/support clearance, and machine restrictions. Large rack or custom layouts may
need to be printed as separate bins across multiple plates.

## Custom Grid Size

The number inputs in **PRINTER / BASEPLATE** advertise a 1–20 cell range. They are
layout controls, not a validated machine-size limit. The basic baseplate generator
separately requires whole-cell dimensions from 1 to 50; that does not make a large
layout printable on the selected machine.

The real-world size is displayed automatically: `cols × 42mm` by `rows × 42mm`.

## Choosing a Preset

Click any preset button to instantly resize the grid. Bins that no longer fit within the new grid boundaries remain in place but may extend beyond the grid edge.

::: tip
If you change the grid size after placing bins, use **Optimize Layout** to automatically repack all bins into the smallest possible grid.
:::
