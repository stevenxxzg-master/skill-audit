import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { saveReport, loadHistory, getLatest } from '../src/history.js';

function makeReport(dangerCount = 0, warnCount = 0) {
  const findings = [];
  for (let i = 0; i < dangerCount; i++) {
    findings.push({ severity: 'danger', rule: 'test/danger', file: 'test.js', line: i + 1, msg: 'danger' });
  }
  for (let i = 0; i < warnCount; i++) {
    findings.push({ severity: 'warn', rule: 'test/warn', file: 'test.js', line: i + 1, msg: 'warn' });
  }
  const summary = { pass: findings.length === 0 ? 1 : 0, warn: warnCount, danger: dangerCount, files: 1 };
  return { target: '/test', files: ['test.js'], findings, summary };
}

describe('history', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'skill-audit-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('saveReport creates .skill-audit/ dir and scan file', async () => {
    const report = makeReport(1, 2);
    const result = await saveReport(tmpDir, report);
    assert.ok(result.path.includes('.skill-audit/scan-'));
    assert.ok(result.timestamp > 0);

    const files = await readdir(join(tmpDir, '.skill-audit'));
    assert.equal(files.length, 1);
    assert.ok(files[0].startsWith('scan-'));
    assert.ok(files[0].endsWith('.json'));
  });

  it('saved report contains timestamp', async () => {
    const report = makeReport(0, 1);
    const result = await saveReport(tmpDir, report);
    const content = JSON.parse(await readFile(result.path, 'utf-8'));
    assert.equal(content.timestamp, result.timestamp);
    assert.deepEqual(content.findings, report.findings);
  });

  it('loadHistory returns empty array when no history', async () => {
    const history = await loadHistory(tmpDir);
    assert.deepEqual(history, []);
  });

  it('loadHistory returns reports sorted newest first', async () => {
    await saveReport(tmpDir, makeReport(1, 0));
    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));
    await saveReport(tmpDir, makeReport(0, 2));

    const history = await loadHistory(tmpDir);
    assert.equal(history.length, 2);
    assert.ok(history[0].timestamp > history[1].timestamp);
  });

  it('loadHistory respects limit', async () => {
    await saveReport(tmpDir, makeReport(1, 0));
    await new Promise(r => setTimeout(r, 10));
    await saveReport(tmpDir, makeReport(0, 1));
    await new Promise(r => setTimeout(r, 10));
    await saveReport(tmpDir, makeReport(0, 2));

    const history = await loadHistory(tmpDir, 2);
    assert.equal(history.length, 2);
  });

  it('getLatest returns most recent report', async () => {
    await saveReport(tmpDir, makeReport(3, 0));
    await new Promise(r => setTimeout(r, 10));
    const secondReport = makeReport(0, 1);
    await saveReport(tmpDir, secondReport);

    const latest = await getLatest(tmpDir);
    assert.ok(latest);
    assert.equal(latest.findings.length, 1);
    assert.equal(latest.findings[0].severity, 'warn');
  });

  it('getLatest returns null when no history', async () => {
    const latest = await getLatest(tmpDir);
    assert.equal(latest, null);
  });
});
