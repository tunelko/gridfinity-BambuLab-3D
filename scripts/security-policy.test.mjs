import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8');
const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

// These are policy regressions for the checked-in workflow, not a YAML validator
// or a replacement for exercising the scanners in GitHub Actions.
function job(id) {
  const marker = `\n  ${id}:\n`;
  expect(workflow).toContain(marker);
  return workflow.slice(workflow.indexOf(marker) + marker.length).split(/\n  [\w-]+:\n/)[0];
}

describe('security workflow failure policy', () => {
  it('does not suppress scanner failures', () => {
    expect(workflow).not.toMatch(/continue-on-error:|\|\|\s*true/);
  });

  it('audits both locked dependency trees and fails at high severity', () => {
    const audit = job('npm-audit');
    expect(audit).toContain('directory: [., docs]');
    expect(audit).toContain('fail-fast: false');
    expect(audit).toContain('working-directory: ${{ matrix.directory }}');
    expect(audit).toContain('npm ci --ignore-scripts --no-audit');
    expect(audit).toContain('run: npm audit --audit-level=high');
  });

  it('makes Hadolint errors and warnings fail its job', () => {
    const lint = job('hadolint');
    expect(lint).toContain('dockerfile: [Dockerfile, docs/Dockerfile]');
    expect(lint).toContain('dockerfile: ${{ matrix.dockerfile }}');
    expect(lint).toContain("no-fail: 'false'");
    expect(lint).toContain('failure-threshold: warning');
  });

  it('makes one high or critical Grype finding fail, even without a fix', () => {
    const scan = job('grype');
    expect(scan).toContain('severity-cutoff: high');
    expect(scan).toContain("fail-build: 'true'");
    expect(scan).toContain("only-fixed: 'false'");
  });

  it('retains SARIF uploads after scanner failures', () => {
    expect(job('hadolint')).toContain("if: always() && hashFiles('hadolint-results.sarif') != ''");
    expect(job('grype')).toContain("if: always() && hashFiles('grype-results.sarif') != ''");
    expect(job('grype')).toContain('output-file: grype-results.sarif');
    expect(job('grype')).toContain('sarif_file: grype-results.sarif');
    expect(job('grype')).toContain('grype-version: v0.121.0');
  });

  it('uses the patched Node release consistently in CI and Docker builders', () => {
    const version = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
    expect(version).toBe('24.22.1');
    for (const source of [workflow, ciWorkflow]) {
      expect(source).toContain('node-version-file: .nvmrc');
      expect(source).not.toMatch(/node-version:\s*24\b/);
      expect(source).not.toMatch(/actions\/(checkout|setup-node)@v4/);
    }
    for (const path of ['../Dockerfile', '../docs/Dockerfile']) {
      const dockerfile = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(dockerfile).toContain(`FROM node:${version}-alpine3.24@sha256:`);
      expect(dockerfile).toMatch(/^FROM nginx:1\.30\.6-alpine3\.24-slim@sha256:[a-f0-9]{64} AS runtime$/m);
      expect(dockerfile).toContain('npm@11.21.1');
      expect(dockerfile).toContain('undici@6.29.1 ip-address@10.7.4');
    }
  });

  it('rebuilds the docs esbuild binary with a patched Go toolchain', () => {
    const dockerfile = readFileSync(new URL('../docs/Dockerfile', import.meta.url), 'utf8');
    expect(dockerfile).toContain('FROM golang:1.27.3-alpine3.24@sha256:');
    expect(dockerfile).toContain('go get github.com/evanw/esbuild@v0.25.12 golang.org/x/sys@v0.44.0');
    expect(dockerfile).toContain('go build -o /out/esbuild github.com/evanw/esbuild/cmd/esbuild');
    expect(dockerfile).toContain('COPY --from=esbuild /out/esbuild /tmp/esbuild');
    expect(dockerfile).toContain('install -m 755 /tmp/esbuild node_modules/esbuild/bin/esbuild');
    expect(dockerfile).toContain("node_modules/@esbuild/linux-$(node -p 'process.arch')/bin/esbuild");
  });

  it('builds and scans both stages of both service images', () => {
    const scan = job('container-scan');
    expect(scan).toContain('service: [app, docs]');
    expect(scan).toContain('target: [build, runtime]');
    expect(scan).toContain('context: .');
    expect(scan).toContain('context: docs');
    expect(scan).toContain('docker build --pull');
    expect(scan).toContain('--target "${{ matrix.target }}"');
    expect(scan).toContain('image: gridfinity-${{ matrix.service }}-${{ matrix.target }}:scan');
    expect(scan).toContain('severity-cutoff: high');
    expect(scan).toContain('grype-version: v0.121.0');
    expect(scan).toContain("fail-build: 'true'");
    expect(scan).toContain("only-fixed: 'false'");
    expect(scan).toContain("if: always() && hashFiles('grype-image.sarif') != ''");
    expect(scan).toContain('category: grype-image-${{ matrix.service }}-${{ matrix.target }}');
  });
});
