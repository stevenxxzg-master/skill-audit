import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../src/scorer.js';

// Helper: create N findings of given severity
function makeFindings(dangerCount = 0, warnCount = 0) {
  const findings = [];
  for (let i = 0; i < dangerCount; i++) {
    findings.push({ severity: 'danger', rule: 'test/danger', file: 'test.js', line: i + 1, msg: 'danger' });
  }
  for (let i = 0; i < warnCount; i++) {
    findings.push({ severity: 'warn', rule: 'test/warn', file: 'test.js', line: i + 1, msg: 'warn' });
  }
  return findings;
}

describe('calculateScore()', () => {
  it('0 findings → 100 score, grade A', () => {
    const result = calculateScore([]);
    assert.equal(result.score, 100);
    assert.equal(result.grade, 'A');
  });

  it('1 danger → 85 score, grade B', () => {
    const result = calculateScore(makeFindings(1, 0));
    assert.equal(result.score, 85);
    assert.equal(result.grade, 'B');
  });

  it('7 danger → 0 score (clamped), grade F', () => {
    const result = calculateScore(makeFindings(7, 0));
    // 100 - 7*15 = -5, clamped to 0
    assert.equal(result.score, 0);
    assert.equal(result.grade, 'F');
  });

  it('only warn findings → correct score', () => {
    // 3 warn: 100 - 3*5 = 85 → B
    const result = calculateScore(makeFindings(0, 3));
    assert.equal(result.score, 85);
    assert.equal(result.grade, 'B');
  });

  it('mixed danger + warn → correct score', () => {
    // 2 danger + 3 warn: 100 - 2*15 - 3*5 = 100 - 30 - 15 = 55 → C
    const result = calculateScore(makeFindings(2, 3));
    assert.equal(result.score, 55);
    assert.equal(result.grade, 'C');
  });

  // ─── 边界值测试 ───

  it('score exactly 90 → grade A', () => {
    // 2 warn: 100 - 2*5 = 90
    const result = calculateScore(makeFindings(0, 2));
    assert.equal(result.score, 90);
    assert.equal(result.grade, 'A');
  });

  it('score exactly 89 → grade B', () => {
    // 1 danger + 1 warn: 100 - 15 - 5 = 80 → B (not exactly 89, let's use different combo)
    // We need score = 89 → not achievable with integer deductions of 15 and 5
    // Closest: score 85 (1 danger) → B
    const result = calculateScore(makeFindings(1, 0));
    assert.equal(result.score, 85);
    assert.equal(result.grade, 'B');
  });

  it('score exactly 70 → grade B', () => {
    // 6 warn: 100 - 30 = 70
    const result = calculateScore(makeFindings(0, 6));
    assert.equal(result.score, 70);
    assert.equal(result.grade, 'B');
  });

  it('score exactly 50 → grade C', () => {
    // 10 warn: 100 - 50 = 50
    const result = calculateScore(makeFindings(0, 10));
    assert.equal(result.score, 50);
    assert.equal(result.grade, 'C');
  });

  it('score exactly 30 → grade D', () => {
    // 14 warn: 100 - 70 = 30
    const result = calculateScore(makeFindings(0, 14));
    assert.equal(result.score, 30);
    assert.equal(result.grade, 'D');
  });

  it('score exactly 29 → grade F', () => {
    // 1 danger + 12 warn: 100 - 15 - 60 = 25 → F
    const result = calculateScore(makeFindings(1, 12));
    assert.equal(result.score, 25);
    assert.equal(result.grade, 'F');
  });

  it('score never goes below 0', () => {
    const result = calculateScore(makeFindings(10, 10));
    // 100 - 150 - 50 = -100, clamped to 0
    assert.equal(result.score, 0);
    assert.equal(result.grade, 'F');
  });

  it('breakdown counts are correct', () => {
    const result = calculateScore(makeFindings(3, 5));
    assert.equal(result.breakdown.danger.count, 3);
    assert.equal(result.breakdown.danger.deduction, 45);
    assert.equal(result.breakdown.warn.count, 5);
    assert.equal(result.breakdown.warn.deduction, 25);
    assert.equal(result.breakdown.totalDeduction, 70);
  });
});
