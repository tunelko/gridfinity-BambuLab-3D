# Dependency advisory remediation

On 2026-09-11, the application audit went from **11 reported vulnerable packages to 0**, and the documentation audit from **3 to 0**. Both full dependency trees are checked, not only production dependencies. An empty audit means no advisories reported by the registry at that time, not a security certification.

## Reproduce the checks

```bash
npm ci
npm audit
npm test
npm run build
npm run export:fit-test
npm ci --prefix docs
npm audit --prefix docs
npm run build --prefix docs
```

Use Node 24, as in the Docker builds and existing CI. Commit both lockfiles; the docs Dockerfile now uses `npm ci` instead of resolving a new dependency tree on every build.

## Changes and compatibility boundary

| Area | Change |
|---|---|
| Tests | Vitest 4.1.9 → 4.1.11; minimum requested version also updated |
| Image-processing transitives | `ndarray-pixels` 5.0.1 → 5.2.0, bringing `sharp` 0.35.4 and patched native libraries |
| Other transitives | Updated patched releases of `brace-expansion`, `browserslist`, `baseline-browser-mapping`, `fast-uri`, `fflate`, `nanoid`, and `postcss` within the dependency graph's accepted ranges |
| CAD/rendering | Manifold 3.3.2 and Three.js 0.170.0 unchanged |
| Documentation | VitePress 1.6.4 retained; scoped override replaces its Vite 5 dependency with Vite 6.4.3 and esbuild 0.25.12 |

The Vite override deliberately exceeds VitePress's declared Vite range, while remaining within the installed Vue plugin's Vite 5/6 peer range. It is a tested compatibility workaround, not a claim of upstream support. Remove it when a stable VitePress release declares a patched Vite dependency, after repeating build, development-server, navigation, and search checks. No prerelease VitePress upgrade or forced audit migration was used.

Upstream evidence: [Vitest's patched-version advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9), [Vite's patched-version advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff), and the [Vite 5 → 6 migration guide](https://v6.vite.dev/guide/migration).

## Verification record

- Fresh application and docs installs from their lockfiles succeeded.
- `npm audit`, `npm audit --omit=dev`, and `npm audit --prefix docs`: zero reported vulnerabilities.
- All 40 geometry/export/cache tests passed with Vitest 4.1.11.
- Application and documentation builds passed; the application bundle hashes remained unchanged.
- `npm run export:fit-test` generated the same three printable objects; the ZIP/XML regression checks their dimensions, topology, and mating.

The browser and container checks for this maintenance unit are recorded in its commit message. The original geometry checks are in the [mating-profile verification record](./fit-validation.md).

## Remaining non-audit warnings

- The application bundle remains about 859KB before compression. This is a performance warning, not a vulnerability; no warning threshold was raised.
- Manifold's Node-only `module` import is externalized in the browser build. Browser WASM initialization and 3MF generation were checked; the warning was not suppressed.
- Transitive `glob` and `source-map` releases emit deprecation notices. They do not currently produce audit findings in the locked tree; replacing their parent tooling is a separate compatibility change.
- npm may report install-script policy notices for dependencies. No global script policy was changed to hide them.

## Rollback boundary

Revert this unit's Vitest range in `package.json`, `package-lock.json`, `docs/package.json`, `docs/package-lock.json`, `docs/Dockerfile`, and this record together. Keep the existing fit-test npm script and all geometry/UI changes. That restores the previous dependency behavior but also restores the reported advisories; it is an emergency rollback, not the preferred steady state.
