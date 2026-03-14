/**
 * @file report-utils.js
 * @description Shared report formatting utilities for reporter and html-reporter
 * @license MIT
 */

/**
 * Group findings by file path
 * @param {Array} findings
 * @returns {Map<string, Array>}
 */
export function groupByFile(findings) {
  const byFile = new Map()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  return byFile
}

/**
 * Get icon for severity level (terminal)
 * @param {'danger'|'warn'|'pass'} severity
 * @returns {string}
 */
export function severityIcon(severity) {
  if (severity === 'danger') return '✗'
  if (severity === 'warn') return '⚠'
  return '✓'
}

/**
 * Get ANSI color code for severity level
 * @param {'danger'|'warn'|'pass'} severity
 * @returns {string}
 */
export function severityColor(severity) {
  if (severity === 'danger') return '\x1b[31m'
  if (severity === 'warn') return '\x1b[33m'
  return '\x1b[32m'
}

/**
 * Get hex color for severity (used in HTML/SVG)
 * @param {number} score
 * @returns {string}
 */
export function scoreHexColor(score) {
  if (score >= 70) return '#2da44e'
  if (score >= 40) return '#bf8700'
  return '#cf222e'
}

/**
 * Get human-readable label for grade
 * @param {string} grade
 * @returns {string}
 */
export function gradeLabel(grade) {
  const map = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Poor', F: 'Critical' }
  return map[grade] || ''
}

/**
 * Get severity emoji (for markdown reports)
 * @param {'danger'|'warn'|'pass'} severity
 * @returns {string}
 */
export function severityEmoji(severity) {
  if (severity === 'danger') return '🔴'
  if (severity === 'warn') return '🟡'
  return '🟢'
}
