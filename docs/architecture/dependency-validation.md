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

## Blocking security policy

The Security Scan workflow fails when npm audit or Grype reports **one or more high or critical vulnerabilities**. Lower-severity findings remain visible without failing those scanners. Scanner execution errors also fail the job; missing reports are not treated as evidence of a clean scan.

| Check | Failure threshold and scope |
|---|---|
| npm audit | High or critical, in either the application or documentation dependency tree, including development dependencies. Both use `npm ci --ignore-scripts --no-audit` and their committed lockfiles before `npm audit --audit-level=high`. |
| Grype | High or critical, including findings without an available fix. The filesystem scan retains its existing repository scope. |
| Hadolint | Error or warning in the root Dockerfile. These are lint levels, not CVSS high/critical classifications. Info/style findings remain advisory. |

Independent jobs continue collecting findings after another job fails. Hadolint and Grype still upload an available SARIF report after failure; uploading the report does not turn the failed job green. No severity overrides, advisory dismissals, or new exclusions are added.

`npm test -- scripts/security-policy.test.mjs` checks the configured thresholds, both npm roots, failure propagation, and SARIF upload conditions. It is a static policy regression test, not a YAML validator or an end-to-end GitHub runner test. The five checks failed against the previous workflow before its permissive settings were changed.

Local verification on 2026-09-12:

- `npm test`: 45 tests passed; the focused policy and 3MF command (`npm test -- scripts/security-policy.test.mjs src/gridfinity/export3mf.test.ts`) passed all 6 tests.
- `npm audit --audit-level=high` and `npm audit --prefix docs --audit-level=high`: zero reported vulnerabilities, exit 0.
- `npm run build` and `npm run build --prefix docs`: passed. PyYAML parsed the workflow and verified its two-directory matrix and triggers.
- Hadolint 2.14.0, matching the pinned action, ran with `--failure-threshold warning --format json`: the root Dockerfile returned `[]` and exit 0. Harmless stdin-only fixtures with a `RUN cd /tmp` warning and an incomplete `COPY` error each returned exit 1. No fixture image was built or executed.
- These local checks preceded the first GitHub run of the new policy. Grype's high/critical failure path was checked against the pinned action's implementation and workflow settings, not exercised with a vulnerable fixture. Check GitHub Actions for the result on the published commit.

This policy does **not** add automatic deployment or change repository branch protection. A failed workflow is not itself a guarantee that GitHub prevents a merge: requiring the security checks on protected branches is a separate repository setting.

Rollback this policy by reverting `.github/workflows/security.yml`, `scripts/security-policy.test.mjs`, and this section together. Dependency versions, geometry, and exported files are unchanged; rollback restores the previous non-blocking scanner behavior.

## Remaining non-audit warnings

- The application bundle remains about 859KB before compression. This is a performance warning, not a vulnerability; no warning threshold was raised.
- Manifold's Node-only `module` import is externalized in the browser build. Browser WASM initialization and 3MF generation were checked; the warning was not suppressed.
- Transitive `glob` and `source-map` releases emit deprecation notices. They do not currently produce audit findings in the locked tree; replacing their parent tooling is a separate compatibility change.
- npm may report install-script policy notices for dependencies. No global script policy was changed to hide them.

## Rollback boundary

Revert this unit's Vitest range in `package.json`, `package-lock.json`, `docs/package.json`, `docs/package-lock.json`, `docs/Dockerfile`, and this record together. Keep the existing fit-test npm script and all geometry/UI changes. That restores the previous dependency behavior but also restores the reported advisories; it is an emergency rollback, not the preferred steady state.
