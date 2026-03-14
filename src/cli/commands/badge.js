/**
 * @file cli/commands/badge.js
 * @description Badge subcommand — generate SVG badge for a skill
 * @license MIT
 */

import { resolve } from 'path'
// skill-audit-ignore-next-line
import { writeFile } from 'fs/promises'
import { audit } from '../../index.js'
import { calculateScore } from '../../scorer.js'
import { generateBadge } from '../../badge.js'
import { COLORS } from '../../utils.js'
import { positional, getArg } from '../parser.js'

export async function runBadge() {
  const badgeTarget = positional[1]
  if (!badgeTarget) {
    console.error(`${COLORS.red}✗ Usage: skill-audit badge <skill-dir> [-o badge.svg]${COLORS.reset}`)
    process.exit(2)
  }

  const badgeOutputPath = getArg('--output', '-o')
  const badgeTargetPath = resolve(badgeTarget)

  try {
    const report = await audit(badgeTargetPath)
    const { score, grade } = calculateScore(report.findings)
    const svg = generateBadge(score, grade)
    if (badgeOutputPath) {
      await writeFile(resolve(badgeOutputPath), svg, 'utf-8')
      console.log(`${COLORS.green}✓ Badge written to ${resolve(badgeOutputPath)}${COLORS.reset}`)
    } else {
      process.stdout.write(svg)
    }
    process.exit(0)
  } catch (err) {
    console.error(`${COLORS.red}✗ Error: ${err.message}${COLORS.reset}`)
    process.exit(2)
  }
}
