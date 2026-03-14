import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from '../src/index.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, 'fixtures');

describe('audit() integration', () => {
  it('clean skill returns 0 findings', async () => {
    const report = await audit(join(fixtures, 'clean-skill'));
    assert.equal(report.findings.length, 0);
    assert.equal(report.summary.danger, 0);
    assert.equal(report.summary.warn, 0);
    assert.equal(report.summary.pass, 1);
    assert.equal(report.summary.files, 3);
  });

  it('evil skill returns expected danger and warn findings', async () => {
    const report = await audit(join(fixtures, 'evil-skill'));
    assert.ok(report.findings.length > 0, 'should have findings');
    assert.equal(report.summary.danger, 34);
    assert.equal(report.summary.warn, 40);
    assert.equal(report.summary.pass, 0);
  });

  it('mixed skill has only warn, no danger', async () => {
    const report = await audit(join(fixtures, 'mixed-skill'));
    assert.ok(report.findings.length > 0, 'should have findings');
    assert.equal(report.summary.danger, 0);
    assert.ok(report.summary.warn > 0, 'should have warnings');
    assert.equal(report.summary.warn, 19);
  });

  it('throws on non-existent directory', async () => {
    await assert.rejects(
      () => audit(join(fixtures, 'does-not-exist')),
      { code: 'ENOENT' }
    );
  });

  it('throws on empty directory (no scannable files)', async () => {
    await assert.rejects(
      () => audit(join(fixtures, 'empty-skill')),
      { message: 'No scannable files found' }
    );
  });

  it('report contains correct file list', async () => {
    const report = await audit(join(fixtures, 'clean-skill'));
    assert.ok(report.files.includes('index.js'));
    assert.ok(report.files.includes('SKILL.md'));
    assert.ok(report.files.includes('config.yaml'));
  });

  it('findings have required fields', async () => {
    const report = await audit(join(fixtures, 'evil-skill'));
    for (const f of report.findings) {
      assert.ok(f.rule, 'finding should have rule');
      assert.ok(f.severity, 'finding should have severity');
      assert.ok(f.file, 'finding should have file');
      assert.ok(typeof f.line === 'number', 'finding should have line number');
      assert.ok(f.msg, 'finding should have msg');
    }
  });

  it('findings are sorted by severity (danger first)', async () => {
    const report = await audit(join(fixtures, 'evil-skill'));
    const severities = report.findings.map(f => f.severity);
    const dangerEnd = severities.lastIndexOf('danger');
    const warnStart = severities.indexOf('warn');
    assert.ok(dangerEnd < warnStart, 'all danger findings should come before warn');
  });

  it('each rule module detects its patterns in evil skill', async () => {
    const report = await audit(join(fixtures, 'evil-skill'));
    const ruleIds = new Set(report.findings.map(f => f.rule.split('/')[0]));
    assert.ok(ruleIds.has('dangerous-commands'), 'should detect dangerous commands');
    assert.ok(ruleIds.has('secret-leaks'), 'should detect secret leaks');
    assert.ok(ruleIds.has('prompt-injection'), 'should detect prompt injection');
    assert.ok(ruleIds.has('suspicious-network'), 'should detect suspicious network');
    assert.ok(ruleIds.has('permission-audit'), 'should detect permission issues');
    assert.ok(ruleIds.has('dependency-audit'), 'should detect dependency issues');
    assert.ok(ruleIds.has('file-system-audit'), 'should detect file system issues');
  });
});
