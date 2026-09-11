# Mating-profile change: verification record

Observed on 2026-09-11 on `fix/gridfinity-mating-profiles`, based on `0bf0d1e`. Deployment is separately authorized by the maintainer; this record is not physical-fit certification.

## Work units and rollback boundaries

1. **Mating geometry and dimensions.** `src/gridfinity/spec.ts`, `constants.ts`, `profiles.ts`, `binGeometry.ts`, `binGeometry.test.ts`, and `mating.test.ts` define and verify the profiles and protect shallow-bin feet from label cuts. Height-display changes in `BinConfigurator.tsx`, `GridCanvas2D.tsx`, `Sidebar.tsx`, and `Viewport3D.tsx` belong with this behavior. The associated specification/configuration/CSG documentation must change with the geometry. Roll back dependent unit 2 first; then remove this unit's profile, feature-isolation, and displayed-height changes together, without removing unrelated UI behavior.
2. **Printable fit kit and real baseplate preview.** `baseplateGeometry.ts`, `meshData.ts`, `fitKit.ts`, `export3mf.test.ts`, `scripts/export-fit-kit.mjs`, the package script, artifact ignore rule, worker baseplate/mesh support, toolbar Fit Test action, and viewport socket rendering form one runtime path. The fit-test guide and export/pipeline documentation explain it. Rollback removes those additions and restores the former preview baseplate and worker extraction, keeping unit 1's bin mating geometry and height displays.
3. **Cached-preview race.** The cancellation-order change in `src/hooks/useManifoldWorker.ts` and `useManifoldWorker.test.ts` are independently reversible. Do not remove the separate baseplate request overload when reverting this fix.

## Automated evidence

| Command | Observed result |
|---|---|
| `npm test` | 40 tests passed across four files |
| `npm test -- src/gridfinity/binGeometry.test.ts src/gridfinity/mating.test.ts` | 38 geometry tests passed |
| `npm test -- src/gridfinity/export3mf.test.ts src/hooks/useManifoldWorker.test.ts` | 3MF round trip and stale-preview regression passed |
| `npm run build` | Passed TypeScript and production bundle generation |
| `npm run build --prefix docs` | VitePress build passed |
| `npm run export:fit-test` | Created two 1×1×1u bins and a 2×1 baseplate in `artifacts/gridfinity-fit-test.3mf` |

The new socket tests failed on the former profile. The shallow-bin label test also reproduced removal of foot material before the cut was limited to cavity height. The production build still warns about the Manifold browser external and a large JavaScript chunk; those warnings are not fit-test failures.

## Browser boundary

Served the production bundle with `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort` and exercised it in Chromium 152 through the browser's debugging protocol, using an isolated profile and bypassing its service-worker cache.

- Loaded the app, added a Small Parts bin, and visually checked it over a real 6×6 socket baseplate.
- Exported the layout: one mesh, with no preview baseplate added to the print job.
- Clicked Fit Test: three meshes, with serialized mesh sections identical to the CLI-generated 3MF.
- Observed successful worker responses for the baseplate, preview, export, and fit-kit objects, with no application errors or warnings.

The first browser attempt could not create WebGL in this headless environment. Relaunching with `--ozone-platform=headless --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` and without display-server variables allowed the visual check. This was a test-environment adjustment, not an application patch or slicer test.

## Remaining physical check

No slicer application or physical printer was exercised. Print the [fit kit](/guide/fit-test) at 100% scale and check both stacking directions, rotated insertion, and a known-good external baseplate before printing a full layout. Oversized custom magnet holes can shift retention centers; their alignment is not certified by the basic fit kit.
