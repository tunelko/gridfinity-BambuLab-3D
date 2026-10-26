# Dependency advisory remediation

The 2026-10-26 maintenance updates vulnerable dependencies, pins a Node2Shell-patched Node release, and extends blocking scans to both build and runtime images. Geometry, Manifold 3.3.2, Three.js 0.170.0, and the export formats are unchanged. An empty audit means no advisories reported at the time of the check, not a security certification.

## October 2026 remediation

| Component | Updated version or control |
|---|---|
| Application tooling | Vite 8.1.6; Vitest and its mocker 4.1.12 |
| Documentation tooling | VitePress 1.6.4 retained; scoped Vite override advanced to 6.4.4 |
| Transitive dependencies | sharp 0.35.5, source-map-js 1.2.2 in both trees, fast-uri 3.1.9, serialize-javascript 7.1.4 |
| Node | 24.22.1 in `.nvmrc`, both CI workflows, and both Docker builders; package engines require the patched Node 24 line |
| Builder package manager | npm 11.21.1, with its bundled undici and ip-address replaced by compatible 6.29.1 and 10.7.4 releases before project installation |
| Documentation native compiler | The same esbuild 0.25.12 source rebuilt with Go 1.27.3 and golang.org/x/sys 0.44.0; both installed binary copies are replaced and its version checked |
| Runtime images | Nginx 1.30.6 on Alpine 3.24, using the official slim variant; both base images are pinned by digest |
| Container checks | Grype 0.121.0 scans the build and runtime stages of both services; high/critical findings fail, including those without a fix |

The previous GitHub runner selected cached Node 24.21.0 for the floating `24` request. An exact `.nvmrc` prevents that fallback. Node 24.22.1 includes the Brotli fix for [CVE-2026-111497](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases); `npm audit fix` alone cannot patch a Node executable or an OS library.

The previous runtime images contained Alpine's vulnerable `brotli-libs 1.1.0-r2`, even though the active static Nginx configuration did not decode Brotli requests. The slim variant omits the unused image-processing modules and their Brotli dependencies. Runtime verification must check the actual built image rather than infer safety from the Dockerfile tag.

The first image scans also found vulnerabilities in npm's own bundled packages and the Go runtime embedded in the upstream esbuild binary. These are not fixed by auditing the project lockfiles. The Docker builders explicitly remediate them without suppressions. Recheck the temporary npm bundle replacements when upstream npm incorporates the fixes. For the rebuilt native esbuild toolchain, use the docs Docker build: a host-side `npm ci --prefix docs` still installs the upstream binary, not the Docker-specific rebuild.

The GitHub image scan additionally reported [GO-2026-5024](https://pkg.go.dev/vuln/GO-2026-5024) in esbuild's old `golang.org/x/sys` dependency. The affected function is Windows-only, but the build now uses the fixed 0.44.0 module instead of retaining an affected dependency version or suppressing the alert.

Both GitHub Grype jobs explicitly select 0.121.0, matching the local verification tool. The action's older implicit scanner default is no longer used.

All dependency updates remain within their existing major versions. The VitePress override is still a compatibility workaround: its Vite 6 peer compatibility and documentation navigation/search must be checked on every update. The sharp update follows Manifold's existing transitive dependency chain without changing the CAD library.

### Verification for this maintenance unit

- Lockfile audits for both trees: zero reported vulnerabilities after the updates.
- New policy regressions first failed against the previous workflows: missing docs lint coverage, patched Node pin, and container scans.
- Fresh installs from both lockfiles and both production builds passed.
- `npm test` in the patched application builder: 59 tests passed, including eight security-policy checks. `npm run export:fit-test` generated the three-object fit kit.
- Actual browser downloads passed for all-bin ZIP, selected-bin ZIP, fit-kit ZIP and direct 3MF. ZIP CRCs, STL triangle records, units and object counts passed, with zero browser exceptions.
- Documentation homepage logos in both themes, local search, result navigation and the dimensional reference passed browser checks against the container built with the rebuilt esbuild binary.
- Actionlint 1.7.12, Hadolint 2.14.0 on both Dockerfiles, and YAML matrix expansion checks passed.
- Grype 0.121.0 with the 2026-10-26 database passed `--fail-on high` on the repository snapshot and all four service/stage images. No findings were ignored or dismissed.
- Both runtime containers reported Nginx 1.30.6 with no Node executable or installed `brotli-libs`. Both builder images reported Node 24.22.1 and npm 11.21.1; both docs esbuild binary copies matched and reported 0.25.12.

### Remaining distribution advisory

Each image retains three medium-severity package matches for the same [BusyBox wget advisory, CVE-2025-60876](https://security.alpinelinux.org/vuln/CVE-2025-60876): `busybox`, `busybox-binsh`, and `ssl_client`, all 1.37.0-r31. Alpine lists that release as possibly vulnerable and provides no fixed package at the time of verification. The active static Nginx configuration does not pass visitor-supplied URLs to wget. This is not a zero-finding image scan: keep the advisory visible, monitor the distribution fix, and update the image pins when it becomes available. No custom suppression or severity reduction is applied.

The checks above are local evidence, not a claim that the new GitHub workflow has run or that production has been redeployed. Verify those separately during delivery. The Docker-specific esbuild rebuild does not replace the upstream binary installed by a host-side docs `npm ci`.

The rollback boundary is the two manifests/lockfiles, `.nvmrc`, both Dockerfiles, both workflows, the policy tests, and the associated documentation. Keep the geometry and export implementation unchanged. Rolling back restores vulnerable versions and is an emergency measure only.

## Previous remediation (2026-09-11)

On 2026-09-11, the application audit went from **11 reported vulnerable packages to 0**, and the documentation audit from **3 to 0**. Both full dependency trees were checked, not only production dependencies. The versions and results below are historical, not the current security status.

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

Use the Node release in `.nvmrc`, as in the Docker builds and CI. Commit both lockfiles; the docs Dockerfile uses `npm ci` instead of resolving a new dependency tree on every build.

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
| Grype | High or critical, including findings without an available fix. Scans the repository plus the build and runtime images of both services. |
| Hadolint | Error or warning in both service Dockerfiles. These are lint levels, not CVSS high/critical classifications. Info/style findings remain advisory. |

Independent jobs continue collecting findings after another job fails. Hadolint and Grype still upload an available SARIF report after failure; uploading the report does not turn the failed job green. No severity overrides, advisory dismissals, or new exclusions are added.

`npm test -- scripts/security-policy.test.mjs` checks the configured thresholds, both npm roots, failure propagation, SARIF upload conditions, patched Node pins, and image-scan coverage. It is a static policy regression test, not a YAML validator or an end-to-end GitHub runner test.

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
