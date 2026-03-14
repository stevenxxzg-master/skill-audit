import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { diffReports } from '../src/diff.js';

function makeFinding(rule, file, line, severity = 'warn') {
  return { rule, file, line, severity, msg: `${rule} at ${file}:${line}` };
}

function makeReport(findings) {
  const summary = { pass: 0, warn: 0, danger: 0, files: 1 };
  for (const f of findings) summary[f.severity]++;
  if (findings.length === 0) summary.pass = 1;
  return { target: '/test', files: ['test.js'], findings, summary };
}

describe('diffReports()', () => {
  it('identical reports → no added, no fixed', () => {
    const findings = [makeFinding('rule/a', 'test.js', 10)];
    const diff = diffReports(makeReport(findings), makeReport(findings));
    assert.equal(diff.added.length, 0);
    assert.equal(diff.fixed.length, 0);
    assert.equal(diff.kept.length, 1);
    assert.equal(diff.score.delta, 0);
  });

  it('new finding → shows as added', () => {
    const oldFindings = [makeFinding('rule/a', 'test.js', 10)];
    const newFindings = [
      makeFinding('rule/a', 'test.js', 10),
      makeFinding('rule/b', 'test.js', 20),
    ];
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.added.length, 1);
    assert.equal(diff.added[0].rule, 'rule/b');
    assert.equal(diff.fixed.length, 0);
    assert.equal(diff.summary.addedCount, 1);
  });

  it('removed finding → shows as fixed', () => {
    const oldFindings = [
      makeFinding('rule/a', 'test.js', 10),
      makeFinding('rule/b', 'test.js', 20),
    ];
    const newFindings = [makeFinding('rule/a', 'test.js', 10)];
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.added.length, 0);
    assert.equal(diff.fixed.length, 1);
    assert.equal(diff.fixed[0].rule, 'rule/b');
    assert.equal(diff.summary.fixedCount, 1);
  });

  it('line offset within ±3 → still matches', () => {
    const oldFindings = [makeFinding('rule/a', 'test.js', 10)];
    const newFindings = [makeFinding('rule/a', 'test.js', 12)]; // offset +2
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.added.length, 0);
    assert.equal(diff.fixed.length, 0);
    assert.equal(diff.kept.length, 1);
  });

  it('line offset beyond ±3 → treated as different', () => {
    const oldFindings = [makeFinding('rule/a', 'test.js', 10)];
    const newFindings = [makeFinding('rule/a', 'test.js', 20)]; // offset +10
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.added.length, 1);
    assert.equal(diff.fixed.length, 1);
  });

  it('score delta is calculated correctly', () => {
    // old: 2 warn → score 90, new: 1 danger → score 85
    const oldFindings = [
      makeFinding('rule/a', 'a.js', 1, 'warn'),
      makeFinding('rule/b', 'b.js', 1, 'warn'),
    ];
    const newFindings = [makeFinding('rule/c', 'c.js', 1, 'danger')];
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.score.old, 90);
    assert.equal(diff.score.new, 85);
    assert.equal(diff.score.delta, -5);
  });

  it('grade change is tracked', () => {
    // old: 0 findings → A, new: 7 danger → F
    const oldFindings = [];
    const newFindings = Array.from({ length: 7 }, (_, i) =>
      makeFinding(`rule/${i}`, 'test.js', i * 10, 'danger')
    );
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.grade.old, 'A');
    assert.equal(diff.grade.new, 'F');
  });

  it('empty old and new → no changes', () => {
    const diff = diffReports(makeReport([]), makeReport([]));
    assert.equal(diff.added.length, 0);
    assert.equal(diff.fixed.length, 0);
    assert.equal(diff.score.delta, 0);
  });

  it('multiple findings with same rule+file match independently', () => {
    const oldFindings = [
      makeFinding('rule/a', 'test.js', 10),
      makeFinding('rule/a', 'test.js', 50),
    ];
    const newFindings = [
      makeFinding('rule/a', 'test.js', 11), // matches line 10
      makeFinding('rule/a', 'test.js', 51), // matches line 50
      makeFinding('rule/a', 'test.js', 90), // new
    ];
    const diff = diffReports(makeReport(oldFindings), makeReport(newFindings));
    assert.equal(diff.kept.length, 2);
    assert.equal(diff.added.length, 1);
    assert.equal(diff.fixed.length, 0);
  });
});
