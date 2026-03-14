/**
 * @file cli/commands/history.js
 * @description History subcommand — view scan history for a skill
 * @license MIT
 */

import { resolve } from 'path'
import { loadHistory } from '../../history.js'
import { calculateScore } from '../../scorer.js'
import { COLORS } from '../../utils.js'
import { positional, getArg } from '../parser.js'

export async function runHistory() {
  const targetDir = positional[1]
  if (!targetDir) {
    console.error(`${COLORS.red}✗ Usage: skill-audit history <skill-dir>${COLORS.reset}`)
    process.exit(2)
  }

  const limitVal = getArg('--limit', '-n')
  const limit = limitVal ? parseInt(limitVal, 10) : undefined
  const history = await loadHistory(resolve(targetDir), limit)

  if (history.length === 0) {
    console.log(`${COLORS.dim}No scan history found for ${targetDir}${COLORS.reset}`)
    process.exit(0)
  }

  console.log(`\n${COLORS.bold}  Scan history${COLORS.reset}  ${COLORS.dim}${resolve(targetDir)}${COLORS.reset}\n`)
  for (const r of history) {
    const date = new Date(r.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')
    const score = calculateScore(r.findings || [])
    const dangerCount = (r.summary && r.summary.danger) || 0
    const warnCount = (r.summary && r.summary.warn) || 0
    const scoreColor = score.score >= 70 ? COLORS.green : score.score >= 40 ? COLORS.yellow : COLORS.red
    console.log(`  ${COLORS.dim}${date}${COLORS.reset}  ${scoreColor}${score.score}/100 ${score.grade}${COLORS.reset}  ${COLORS.red}${dangerCount}D${COLORS.reset} ${COLORS.yellow}${warnCount}W${COLORS.reset}`)
  }
  console.log()
  process.exit(0)
}
