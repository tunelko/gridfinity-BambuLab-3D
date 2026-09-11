# Check the fit before printing a layout

Use **Fit Test** in the toolbar to download `gridfinity-fit-test.3mf`. It contains
two identical 1×1×1u bins with stacking lips and one 2×1 open-bottom baseplate.
The three objects are separated on the print bed; your current layout stays intact.

## Print and check

1. Import the 3MF into your slicer and keep every object at **100% scale**.
2. Check dimensions: each bin is **41.5 × 41.5 × 10.8mm**; the plate is **84 × 42 × 5mm**.
3. Print all three pieces with your usual material and calibrated profile, feet down.
   The file supplies geometry, not printer or filament settings.
4. Place both bins side by side in the plate, then rotate each by 90° and repeat.
5. Stack bin A on B, then B on A. They should enter with light pressure, sit stably,
   and lift apart without scraping or force. Also test against a known-good external baseplate.

If a piece binds, stop before printing the full layout. Record the slicer version,
material, layer height, XY compensation, first-layer expansion compensation,
measured widths, and where contact occurs. Do not scale the entire bin to fix a fit:
that also changes the 42mm grid pitch and magnet spacing.

The drawing's 4.4mm lip ends in a sharp tip. This app trims 0.6mm from that tip,
leaving a printable crown and **3.8mm actual lip height**. The 7mm height unit
includes the foot but excludes the lip.

## Generate from the repository

```bash
npm run export:fit-test
```

The result is `artifacts/gridfinity-fit-test.3mf`. This generated file is ignored
by Git; rerun the command after geometry changes. It uses the same bin, baseplate,
mesh extraction and 3MF packaging functions as the app.

## Validation boundary

`npm test` checks profile dimensions, clearance, contact at the default stacking
seat, mesh connectivity, and the actual 3MF round trip. Physical fit remains
unverified until these printed checks pass. See the
[dimension reference](../reference/specification.md) for socket heights and datums.
