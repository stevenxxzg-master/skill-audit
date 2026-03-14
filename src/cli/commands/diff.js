/**
 * @file cli/commands/diff.js
 * @description Diff subcommand — compare two scan report files
 * @license MIT
 */

import { resolve } from 'path'
// skill-audit-ignore-next-line
import { readFile } from 'fs/promises'
import { diffReports } from '../../diff.js'
import { COLORS } from '../../utils.js'
import { positional } from '../parser.js'

export async function runDiff() {
  const oldPath = positional[1]
  const newPath = positional[2]
  if (!oldPath || !newPath) {
    console.error(`${COLORS.red}✗ Usage: skill-audit diff <old.json> <new.json>${COLORS.reset}`)
    process.exit(2)
  }

  const oldReport = JSON.parse(await readFile(resolve(oldPath), 'utf-8'))
  const newReport = JSON.parse(await readFile(resolve(newPath), 'utf-8'))
  const diff = diffReports(oldReport, newReport)
  printDiffResult(diff)
  process.exit(0)
}

function printDiffResult(diff) {
  console.log(`\n${COLORS.bold}  Diff Report${COLORS.reset}\n`)

  if (diff.added.length > 0) {
    console.log(`  ${COLORS.red}+${diff.added.length} new issues:${COLORS.reset}`)
    for (const f of diff.added) {
      console.log(`    ${COLORS.red}✗${COLORS.reset} ${COLORS.dim}${f.file}:${f.line}${COLORS.reset} ${f.msg}`)
    }
    console.log()
  }

  if (diff.fixed.length > 0) {
    console.log(`  ${COLORS.green}-${diff.fixed.length} fixed:${COLORS.reset}`)
    for (const f of diff.fixed) {
      console.log(`    ${COLORS.green}✓${COLORS.reset} ${COLORS.dim}${f.file}:${f.line}${COLORS.reset} ${f.msg}`)
    }
    console.log()
  }

  if (diff.added.length === 0 && diff.fixed.length === 0) {
    console.log(`  ${COLORS.dim}No changes${COLORS.reset}\n`)
  }

  const arrow = diff.score.delta > 0 ? `${COLORS.green}↑${diff.score.delta}${COLORS.reset}`
    : diff.score.delta < 0 ? `${COLORS.red}↓${Math.abs(diff.score.delta)}${COLORS.reset}`
    : `${COLORS.dim}→ no change${COLORS.reset}`
  console.log(`  score: ${diff.score.old} → ${diff.score.new} (${arrow})`)
  console.log(`  grade: ${diff.grade.old} → ${diff.grade.new}`)
  console.log()
}
