import { calculateScore } from './scorer.js';
import { getSuggestion } from './fixer.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(score) {
  if (score >= 70) return '#2da44e';
  if (score >= 40) return '#bf8700';
  return '#cf222e';
}

function gradeLabel(grade) {
  const map = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' };
  return map[grade] || '';
}

function severityIcon(severity) {
  if (severity === 'danger') return `<span class="sev-icon sev-danger" title="Danger">✗</span>`;
  if (severity === 'warn') return `<span class="sev-icon sev-warn" title="Warning">⚠</span>`;
  return `<span class="sev-icon sev-pass" title="Pass">✓</span>`;
}

export function generateHtml(report, options = {}) {
  const { findings, summary, target } = report;
  const lang = options.lang || 'en';
  const { score, grade, breakdown } = calculateScore(findings);
  const scanTime = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const color = scoreColor(score);

  // Group findings by file
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  // Build findings HTML
  let findingsHtml = '';
  if (findings.length === 0) {
    findingsHtml = `<div class="empty-state"><span class="empty-icon">✓</span><p>No issues found. This skill looks clean.</p></div>`;
  } else {
    for (const [file, items] of byFile) {
      findingsHtml += `<div class="file-group">`;
      findingsHtml += `<div class="file-header"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg> ${escapeHtml(file)}</div>`;
      for (const item of items) {
        const suggestion = getSuggestion(item.rule);
        findingsHtml += `<div class="finding finding-${item.severity}">`;
        findingsHtml += `<div class="finding-header">${severityIcon(item.severity)}<span class="finding-line">L${item.line}</span><span class="finding-msg">${escapeHtml(item.msg)}</span><span class="finding-rule">${escapeHtml(item.rule)}</span></div>`;
        if (item.snippet) {
          findingsHtml += `<pre class="finding-snippet"><code>${escapeHtml(item.snippet)}</code></pre>`;
        }
        findingsHtml += `<div class="finding-fix">💡 ${escapeHtml(suggestion[lang] || suggestion.en)}</div>`;
        findingsHtml += `</div>`;
      }
      findingsHtml += `</div>`;
    }
  }

  const ruleCount = 7; // number of rule modules
  const dangerBadge = summary.danger > 0 ? `<span class="stat-badge stat-danger">${summary.danger} danger</span>` : '';
  const warnBadge = summary.warn > 0 ? `<span class="stat-badge stat-warn">${summary.warn} warning</span>` : '';
  const passBadge = findings.length === 0 ? `<span class="stat-badge stat-pass">all clear</span>` : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill Audit — ${escapeHtml(target)}</title>
<style>
:root {
  --bg: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #eaeef2;
  --border: #d0d7de;
  --border-light: #d8dee4;
  --text: #1f2328;
  --text-secondary: #656d76;
  --text-tertiary: #8b949e;
  --danger: #cf222e;
  --danger-bg: #ffebe9;
  --danger-border: #ff8182;
  --warn: #bf8700;
  --warn-bg: #fff8c5;
  --warn-border: #d4a72c;
  --pass: #2da44e;
  --pass-bg: #dafbe1;
  --pass-border: #4ac26b;
  --accent: #0969da;
  --code-bg: #f6f8fa;
  --shadow: 0 1px 3px rgba(27,31,36,0.12), 0 1px 2px rgba(27,31,36,0.06);
  --shadow-lg: 0 4px 12px rgba(27,31,36,0.15);
  --radius: 6px;
  --radius-lg: 12px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
[data-theme="dark"] {
  --bg: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border: #30363d;
  --border-light: #21262d;
  --text: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #6e7681;
  --danger: #f85149;
  --danger-bg: #490202;
  --danger-border: #f85149;
  --warn: #d29922;
  --warn-bg: #341a04;
  --warn-border: #d29922;
  --pass: #3fb950;
  --pass-bg: #04260d;
  --pass-border: #3fb950;
  --accent: #58a6ff;
  --code-bg: #161b22;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.4);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  min-height: 100vh;
}
.container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
@media (min-width: 768px) { .container { padding: 32px 24px; } }

/* Header */
.header {
  text-align: center;
  padding: 32px 0 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 32px;
}
.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.header-target {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
  margin-bottom: 8px;
}
@media (min-width: 768px) { .header-target { font-size: 24px; } }
.header-time {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* Score ring */
.score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}
.score-ring-wrap {
  position: relative;
  width: 160px;
  height: 160px;
  margin-bottom: 12px;
}
@media (min-width: 768px) {
  .score-ring-wrap { width: 180px; height: 180px; }
}
.score-ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.score-ring-bg { fill: none; stroke: var(--bg-tertiary); stroke-width: 10; }
.score-ring-fg { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1s ease; }
.score-value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: none;
}
.score-number { font-size: 42px; font-weight: 700; line-height: 1; }
.score-label { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.score-grade {
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  padding: 2px 12px;
  border-radius: 20px;
  margin-top: 8px;
}

/* Theme toggle */
.theme-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 16px;
  color: var(--text);
  box-shadow: var(--shadow);
  transition: background 0.2s;
}
.theme-toggle:hover { background: var(--bg-tertiary); }

/* Findings */
.findings-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.file-group {
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg);
  box-shadow: var(--shadow);
}
.file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text);
}
.file-header svg { color: var(--text-secondary); flex-shrink: 0; }
.finding {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}
.finding:last-child { border-bottom: none; }
.finding-danger { border-left: 3px solid var(--danger); }
.finding-warn { border-left: 3px solid var(--warn); }
.finding-pass { border-left: 3px solid var(--pass); }
.finding-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.sev-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.sev-danger { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
.sev-warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
.sev-pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass-border); }
.finding-line {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 4px;
}
.finding-msg { font-size: 14px; font-weight: 500; flex: 1; min-width: 0; }
.finding-rule {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.finding-snippet {
  margin: 8px 0;
  padding: 10px 14px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.45;
}
.finding-snippet code {
  font-family: var(--font-mono);
  color: var(--text);
  white-space: pre;
}
.finding-fix {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  margin-top: 6px;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--pass);
}
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.empty-state p { font-size: 16px; color: var(--text-secondary); }

/* Stats footer */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}
.stat-value { font-size: 28px; font-weight: 700; color: var(--text); }
.stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.stat-badges { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 16px; }
.stat-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}
.stat-danger { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
.stat-warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
.stat-pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass-border); }

/* Footer */
.footer {
  text-align: center;
  padding: 24px 0 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
</head>
<body>
<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle dark/light theme">🌓</button>
<div class="container">
  <div class="header">
    <div class="header-title">Skill Audit Report</div>
    <div class="header-target">${escapeHtml(target)}</div>
    <div class="header-time">${scanTime}</div>
  </div>

  <div class="score-section">
    <div class="score-ring-wrap">
      <svg viewBox="0 0 120 120">
        <circle class="score-ring-bg" cx="60" cy="60" r="50"/>
        <circle class="score-ring-fg" cx="60" cy="60" r="50"
          stroke="${color}"
          stroke-dasharray="${Math.PI * 100}"
          stroke-dashoffset="${Math.PI * 100 * (1 - score / 100)}"/>
      </svg>
      <div class="score-value">
        <span class="score-number" style="color:${color}">${score}</span>
        <span class="score-label">/ 100</span>
      </div>
    </div>
    <span class="score-grade" style="background:${color}20;color:${color};border:1px solid ${color}">${grade} — ${gradeLabel(grade)}</span>
  </div>

  <div class="findings-title">Findings (${findings.length})</div>
  ${findingsHtml}

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${summary.files}</div>
      <div class="stat-label">Files Scanned</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${ruleCount}</div>
      <div class="stat-label">Rule Modules</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${findings.length}</div>
      <div class="stat-label">Issues Found</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary.danger}</div>
      <div class="stat-label">Danger</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary.warn}</div>
      <div class="stat-label">Warnings</div>
    </div>
  </div>
  <div class="stat-badges">${dangerBadge}${warnBadge}${passBadge}</div>

  <div class="footer">Generated by skill-audit</div>
</div>
<script>
function toggleTheme(){
  const d=document.documentElement;
  d.dataset.theme=d.dataset.theme==='dark'?'light':'dark';
}
</script>
</body>
</html>`;
}
