# Documentation and screenshot verification

This update replaces the README's decorative icons and long feature catalogue
with a product overview, current screenshots, export boundaries, and links to
the detailed guides. It also reconciles the dimensional reference, local setup,
printer presets, and export documentation with the checked-in application.

## Screenshot provenance

Captured on 2026-09-12 from the production application with ZIP/STL export
enabled, based on `5d32f5d357df437adb36ec9c0a305e36f813a821`. The three screenshots
were refreshed after the toolbar gained its export-format selector. Mating
geometry is unchanged by the packaging and documentation updates.

| Image | Actual application state |
|---|---|
| `workspace-overview.png` | Split editor, 6 × 4 grid, six example bins, Solid mode |
| `workspace-3d.png` | The same six-bin layout in the 3D viewport |
| `geometry-section.png` | One 2 × 2 × 4u bin, stacking lip, magnet recesses, one divider, section view and dimensions |

Files are stored once under `docs/public/images/` and reused by the README and
VitePress pages. Each image is a 1600 × 1000 PNG captured directly by Chromium
152.0.7977.64; no generated artwork or composited UI is used. Browser chrome,
accounts, credentials, and real saved layouts are not part of the captures.

The capture used an isolated browser profile and the application's existing
layout-link import, followed by real view controls. It waited for font loading
and worker responses before capture and reported zero browser exceptions.
The graphics context used software rendering in the headless environment.
These are software previews, not photographs of printed parts or proof that a
slicer accepts the file.

## Review boundaries

- The separate packaging unit adds ZIP/STL downloads without changing mating
  geometry. The screenshots and guides include its toolbar format selector;
  see the [export verification record](./export-validation.md).
- The 3MF check is a mesh round trip; no independent schema validator or
  automated slicer import has been added.
- Grid pitch, foot height, lip trim, socket sections, and magnet allowances were
  checked against `src/gridfinity/spec.ts` and the geometry generators.
- Setup instructions use Node.js 24 and committed lockfiles, matching CI.
- Printer presets are documented as grid shortcuts, not manufacturer build
  specifications or configured printer profiles.
- Historical images are retained in the repository; current pages no longer
  use the old Bambu Studio image to imply current compatibility testing.

## Verification

The following checks passed locally on 2026-09-12:

| Check | Observed result |
|---|---|
| `npm test` | 56 tests passed across six files, including export and security policy checks |
| `npm run build` | Production application built successfully |
| `npm run build --prefix docs` | Production documentation built successfully, including internal page-link checks |
| README references | Relative file and image links checked separately; no decorative emoji found |
| Documentation browser check | Homepage, specification, export, dependency validation, and getting-started pages hydrated with their images loaded |
| Search and navigation | Searching for “Perimeter clearance” returned the specification; selecting the result navigated to it |
| README browser check | All three 1600 × 1000 screenshots loaded in a local rendered preview |
| Browser diagnostics | Zero JavaScript exceptions and zero failed HTTP responses in the completed check |

The README preview and specification page were also inspected visually. The
README preview approximates GitHub's layout; it is not a test of GitHub's live
renderer. Browser checks used the Chromium version recorded above and local
production previews, not a newly deployed site. They do not establish support
for untested browsers or printers.

The application build still reports the existing large-chunk warning and the
Manifold dependency's browser-externalized Node.js `module` import. These are
build warnings, not failed tests or newly verified security findings.

For subsequent edits, rerun the three commands above, inspect the built pages,
and exercise search. Check README file and image references separately because
the README is not a VitePress route.

## Rollback boundary

Revert this documentation unit's README, related guide/reference pages, homepage,
sidebar additions, and three new screenshots together. Keep the preceding
security workflow and policy test changes. Reverting the security policy later
also requires adjusting the README's security summary; it must describe the
workflow in the same checkout. No application code, deployment, saved layout,
or historical image needs to be removed for a documentation rollback.
