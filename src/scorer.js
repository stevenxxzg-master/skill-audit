const DEDUCTIONS = { danger: 15, warn: 5 };

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export function calculateScore(findings) {
  let dangerCount = 0;
  let warnCount = 0;

  for (const f of findings) {
    if (f.severity === 'danger') dangerCount++;
    else if (f.severity === 'warn') warnCount++;
  }

  const dangerDeduction = dangerCount * DEDUCTIONS.danger;
  const warnDeduction = warnCount * DEDUCTIONS.warn;
  const totalDeduction = dangerDeduction + warnDeduction;
  const score = Math.max(0, 100 - totalDeduction);
  const grade = getGrade(score);

  return {
    score,
    grade,
    breakdown: {
      danger: { count: dangerCount, deduction: dangerDeduction },
      warn: { count: warnCount, deduction: warnDeduction },
      totalDeduction,
    },
  };
}
