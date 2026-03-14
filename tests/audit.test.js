import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from '../src/index.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, 'fixtures');
const cli = join(__dirname, '..', 'bin', 'cli.js');

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
    assert.equal(report.summary.danger, 42);
    assert.equal(report.summary.warn, 60);
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
    assert.ok(ruleIds.has('sandbox-escape'), 'should detect sandbox escape');
    assert.ok(ruleIds.has('config-audit'), 'should detect config issues');
  });
});

// ─── CLI integration tests ───

function runCli(args, expectFail = false) {
  try {
    const stdout = execFileSync('node', [cli, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    if (expectFail) {
      return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
    }
    throw err;
  }
}

describe('CLI --json output', () => {
  it('--json output contains score field', () => {
    const { stdout } = runCli([join(fixtures, 'clean-skill'), '--json']);
    const json = JSON.parse(stdout);
    assert.ok('score' in json, 'JSON output should contain score');
    assert.ok('score' in json.score || typeof json.score.score === 'number' || typeof json.score === 'object',
      'score should be an object');
    assert.equal(typeof json.score.score, 'number', 'score.score should be a number');
    assert.equal(typeof json.score.grade, 'string', 'score.grade should be a string');
  });

  it('--json output has correct structure', () => {
    const { stdout } = runCli([join(fixtures, 'clean-skill'), '--json']);
    const json = JSON.parse(stdout);
    assert.ok('target' in json, 'should have target');
    assert.ok('files' in json, 'should have files');
    assert.ok('findings' in json, 'should have findings');
    assert.ok('summary' in json, 'should have summary');
    assert.ok('score' in json, 'should have score');
  });
});

describe('CLI exit codes', () => {
  it('clean skill → exit code 0', () => {
    const { exitCode } = runCli([join(fixtures, 'clean-skill'), '--json']);
    assert.equal(exitCode, 0);
  });

  it('evil skill → exit code 1', () => {
    const { exitCode } = runCli([join(fixtures, 'evil-skill'), '--json'], true);
    assert.equal(exitCode, 1);
  });
});

describe('CLI error handling', () => {
  it('empty directory → exit code 2', () => {
    const { exitCode, stderr } = runCli([join(fixtures, 'empty-skill')], true);
    assert.equal(exitCode, 2);
  });

  it('non-existent directory → exit code 2', () => {
    const { exitCode, stderr } = runCli([join(fixtures, 'does-not-exist')], true);
    assert.equal(exitCode, 2);
  });
});

describe('CLI --quiet flag', () => {
  it('outputs only score and grade on one line', () => {
    const { stdout } = runCli([join(fixtures, 'clean-skill'), '--quiet']);
    const trimmed = stdout.trim();
    assert.match(trimmed, /^\d+\/100 [A-F]$/);
  });

  it('evil skill quiet output shows score and grade', () => {
    const { stdout } = runCli([join(fixtures, 'evil-skill'), '--quiet'], true);
    const trimmed = stdout.trim();
    assert.match(trimmed, /^\d+\/100 [A-F]$/);
  });
});

describe('CLI --verbose flag', () => {
  it('shows rule IDs in output', () => {
    const { stdout } = runCli([join(fixtures, 'evil-skill'), '--verbose'], true);
    assert.ok(stdout.includes('[dangerous-commands/'), 'should show rule IDs');
    assert.ok(stdout.includes('[sandbox-escape/'), 'should show sandbox-escape rule IDs');
  });
});

describe('CLI --exit-zero flag', () => {
  it('evil skill with --exit-zero returns exit code 0', () => {
    const { exitCode } = runCli([join(fixtures, 'evil-skill'), '--json', '--exit-zero']);
    assert.equal(exitCode, 0);
  });
});
