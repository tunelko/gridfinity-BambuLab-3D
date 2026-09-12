# ZIP and STL export verification

The default toolbar download is a ZIP with `model.3mf`, one binary STL per
part, and `README.txt`. **3MF only** preserves direct 3MF downloads. All three
actions use the same packaging function: selected bin, full layout, and fit kit.
Geometry generation, cached worker buffers, saved layouts, and mating profiles
are unchanged.

## Automated checks

Run `npm test -- src/gridfinity/exportBundle.test.ts src/gridfinity/export3mf.test.ts`.
On 2026-09-12 all 12 focused tests passed; the complete suite passed 56 tests
across six files. The production application and documentation builds were
also checked separately.

- Binary STL uses little-endian float32 coordinates, a triangle count, unit
  normals, and zero attribute bytes, following the
  [documented binary STL structure](https://www.loc.gov/preservation/digital/formats/fdd/fdd000505.shtml).
- Empty/malformed buffers, non-finite coordinates, invalid indices, and
  entirely degenerate meshes fail explicitly.
- Float32 extraction can collapse an edge. Exactly zero-area STL facets are
  omitted; small positive-area facets are preserved without a tolerance cutoff.
- An independent Three.js STLLoader reads the output. The three fit-kit parts
  are rebuilt in Manifold to check closed, connected solids, positive volume,
  original volume, dimensions, and placement against the nested 3MF.
- ZIP CRC checks cover the outer archive and nested 3MF. Numbered, sanitized
  STL names preserve duplicate labels without paths or file overwrites.
- Direct 3MF export remains covered; source mesh buffers are not modified.

The initial fit-kit STL test caught the zero-area facets before delivery. The
final test verifies their removal does not change the printable solid.

## Browser download check

Run a production preview and launch Chromium with an isolated profile and
loopback-only CDP. Supply a fresh empty directory writable by that browser:

```bash
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
# In another terminal, with Chromium/CDP already running:
node scripts/check-export-browser.mjs http://127.0.0.1:4174 /absolute/path/to/empty-download-directory
```

The harness uses a disposable two-bin layout and real toolbar controls. It
checks that ZIP is selected by default, downloads all bins, the selected bin,
and the fit kit, then selects direct 3MF and downloads again. It opens the four
actual browser-downloaded files, checks ZIP CRCs, STL record lengths, 3MF units,
and object counts. It does not intercept or replace the download function.

All four downloads passed locally in Chromium 152.0.7977.64 with zero browser
exceptions. The harness closes its own tab, preserves downloaded evidence, and
refuses a nonempty download directory to avoid accepting stale files. The same
command accepts the public application URL for a post-deployment check.

## Limits and rollback

STL has no standard unit field; its numeric coordinates are millimetres. The
ZIP instructions require extraction and importing either format at 100% scale,
not both. No physical printer, automated slicer import, or independent 3MF
schema/OPC validator is claimed by these tests.

Rollback the packaging unit by reverting `exportStl.ts`, `exportBundle.ts`, its
tests, the browser harness, and the toolbar integration together; restore the
associated export/fit-test documentation. Keep the geometry generators and
security policy. This restores the previous direct-only 3MF workflow without
altering saved layouts or mating dimensions.
