import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink, rm, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { secretLeaks } from '../src/rules/secret-leaks.js';
import { audit } from '../src/index.js';

const TMP_BASE = join(tmpdir(), 'skill-audit-edge-test-' + Date.now());

async function createTmpDir(name) {
  const dir = join(TMP_BASE, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe('symlink loop detection', () => {
  let dir;

  before(async () => {
    dir = await createTmpDir('symlink-loop');
    // Create a valid SKILL.md so the dir is scannable
    await writeFile(join(dir, 'SKILL.md'), '# Test Skill\nA test skill.');
    // Create a symlink loop: dir/loop -> dir
    try {
      await symlink(dir, join(dir, 'loop'));
    } catch {
      // symlink might fail on some systems
    }
  });

  after(async () => {
    await rm(TMP_BASE, { recursive: true, force: true }).catch(() => {});
  });

  it('handles symlink loop without crashing', async () => {
    // Should complete without infinite recursion
    const report = await audit(dir);
    assert.ok(report.files.length >= 1, 'should find at least SKILL.md');
    assert.ok(report.files.includes('SKILL.md'));
  });
});

describe('file count limit', () => {
  let dir;

  before(async () => {
    dir = await createTmpDir('too-many-files');
    // Create 1001 .js files to exceed the limit
    const promises = [];
    for (let i = 0; i <= 1000; i++) {
      promises.push(writeFile(join(dir, `file${i}.js`), `// file ${i}`));
    }
    await Promise.all(promises);
  });

  after(async () => {
    await rm(TMP_BASE, { recursive: true, force: true }).catch(() => {});
  });

  it('throws when file count exceeds 1000', async () => {
    await assert.rejects(
      () => audit(dir),
      { message: /Too many files.*1000/ }
    );
  });
});

describe('total size limit', () => {
  let dir;

  before(async () => {
    dir = await createTmpDir('too-large');
    // Create files that together exceed 50MB
    // Each file is ~500KB (under per-file limit), need ~101 files
    const chunk = 'x'.repeat(500 * 1024) + '\n';
    const promises = [];
    for (let i = 0; i < 105; i++) {
      promises.push(writeFile(join(dir, `big${i}.js`), chunk));
    }
    await Promise.all(promises);
  });

  after(async () => {
    await rm(TMP_BASE, { recursive: true, force: true }).catch(() => {});
  });

  it('throws when total size exceeds 50MB', async () => {
    await assert.rejects(
      () => audit(dir),
      { message: /Total size too large.*50MB/ }
    );
  });
});

describe('inline ignore comments', () => {
  let dir;

  before(async () => {
    dir = await createTmpDir('ignore-comments');
    // Create a file with ignore comments
    const content = [
      '// normal code',
      '// skill-audit-ignore-next-line',
      'eval("this should be ignored")',
      'eval("this should NOT be ignored")',
      '# skill-audit-ignore-next-line',
      'exec("rm -rf / ignored")',
      'exec("rm -rf / not ignored")',
    ].join('\n');
    await writeFile(join(dir, 'test.js'), content);
    await writeFile(join(dir, 'SKILL.md'), '# Test\nA test.');
  });

  after(async () => {
    await rm(TMP_BASE, { recursive: true, force: true }).catch(() => {});
  });

  it('skips findings on lines after ignore comments', async () => {
    const report = await audit(dir);
    // Line 3 (eval) and line 6 (exec rm -rf) should be ignored
    // Line 4 (eval) and line 7 (exec rm -rf) should NOT be ignored
    const evalFindings = report.findings.filter(f => f.rule.includes('eval') && f.file === 'test.js');
    const rmFindings = report.findings.filter(f => f.rule.includes('rm-') && f.file === 'test.js');

    // Only the non-ignored lines should produce findings
    for (const f of evalFindings) {
      assert.notEqual(f.line, 3, 'line 3 should be ignored (eval)');
    }
    for (const f of rmFindings) {
      assert.notEqual(f.line, 6, 'line 6 should be ignored (rm)');
    }

    // The non-ignored lines should still produce findings
    assert.ok(evalFindings.some(f => f.line === 4), 'line 4 eval should be detected');
    assert.ok(rmFindings.some(f => f.line === 7), 'line 7 rm should be detected');
  });
});

describe('secret-leaks false positive reduction', () => {
  let dir;

  before(async () => {
    dir = await createTmpDir('secret-fp');
    // Lines with placeholder words should not trigger
    const content = [
      'const api_key = "example_key_abcdefghijklmnop"',
      'const password = "placeholder_password_12345678"',
      'const token = "dummy_token_abcdefghijklmnop"',
      'const api_key = "real_production_key_abcdef"',
    ].join('\n');
    await writeFile(join(dir, 'config.js'), content);
    await writeFile(join(dir, 'SKILL.md'), '# Test\nA test.');

    // .env.example should be completely skipped
    await writeFile(join(dir, '.env.example'), 'API_KEY="sk-abcdefghijklmnopqrstuvwxyz1234567890"');
  });

  after(async () => {
    await rm(TMP_BASE, { recursive: true, force: true }).catch(() => {});
  });

  it('skips lines with placeholder words', async () => {
    const report = await audit(dir);
    const secretFindings = report.findings.filter(f => f.rule.startsWith('secret-leaks/') && f.file === 'config.js');
    // Only line 4 (real_production_key) should trigger
    for (const f of secretFindings) {
      assert.notEqual(f.line, 1, 'example line should be skipped');
      assert.notEqual(f.line, 2, 'placeholder line should be skipped');
      assert.notEqual(f.line, 3, 'dummy line should be skipped');
    }
  });

  it('skips .env.example files at rule level', () => {
    // .env.example files starting with . are skipped by collectFiles,
    // but the rule also skips them as defense in depth
    const file = { path: '.env.example', rel: '.env.example', ext: '' };
    const content = 'API_KEY="sk-abcdefghijklmnopqrstuvwxyz1234567890"';
    const findings = secretLeaks.scan(content, file);
    assert.equal(findings.length, 0, '.env.example should produce no findings at rule level');
  });
});
