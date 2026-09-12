import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8');

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
  });
});
