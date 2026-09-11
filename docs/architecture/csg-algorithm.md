# CSG Algorithm

Bins and baseplates use the Manifold WASM engine. The mating interfaces have fixed dimensions; cosmetic body corners cannot change the feet or stacking socket.

## Bin Construction

1. Loft a foot for each 42mm cell, with three bands: a 0.8mm lower chamfer, a 1.8mm straight band, and a 2.15mm upper chamfer. The top outline is 41.5mm wide with R3.75 corners.
2. Add the body from Z=4.75mm to `H × 7mm`. Subtract its cavity above `4.75mm + bottomThickness`.
3. Subtract enabled magnet and screw holes.
4. Add the stacking lip, subtract the label cutout, and add dividers when enabled.

Preview and export use the same geometry. Only curve tessellation differs.

## Mating Profiles

`spec.ts` defines the foot, stacking socket, and baseplate socket separately. They are not interchangeable copies of one profile. `profiles.ts` joins rounded-rectangle rings at exact heights; corner radii change by the same amount as the outline inset, preserving the 45-degree offset surface. No thin-disc hulls or scaled corner extrusions are needed.

The stacking socket has a 0.7mm lower lead-in, a 1.8mm straight band, and a theoretical 1.9mm upper chamfer. The last 0.6mm of the sharp tip is trimmed, leaving a printable crown and a 3.8mm actual lip height. An underside transition connects it to thin body walls.

The open-bottom baseplate has its own socket profile, beginning 0.35mm above the print bed and opening to 42mm at the 5mm plate top. Socket cutters are boolean-unioned before subtraction because neighboring mouths touch or overlap.

See [Specification Reference](/reference/specification) for dimensions, datums, and evidence sources.

## Optional Features

| Feature | Operation and constraint |
|---------|--------------------------|
| Magnet holes | Subtract four cylinders per cell; default holes are 6.5mm × 2.4mm for nominal 6mm × 2mm magnets |
| Screw holes | Subtract M3 clearance cylinders through the feet |
| Dividers | Add walls inside the cavity, ending at the body rim |
| Stacking lip | Add the fixed socket even if a thick floor fills a shallow body |
| Label shelf | Subtract a tapered cut from the front wall; limit its depth to the available cavity so it cannot cut the floor or foot |

Hole centers normally form a 26mm square (±13mm from each cell center). Oversized custom magnet holes are clamped inward to preserve material at the foot edge; those custom centers no longer follow the nominal magnet grid. Neighboring cells do not share hole centers.

## Mesh Handling and Tests

Manifold objects require explicit `.delete()` calls. `meshData.ts` checks for nonempty, valid geometry and extracts XYZ positions using the vertex-property stride. Worker outputs and 3MF meshes remain in millimeters with Z up; the viewport alone converts to Y up and reverses triangle winding.

Tests check independent cross-section dimensions, nominal insertion clearance, contact at the seated stacking height, mixed bin sizes, cosmetic radii, feature isolation, and a 3MF round trip. Physical fit still requires the [printable fit test](/guide/fit-test).
