/**
 * @file cli/commands/scan.js
 * @description Main scan command — audit a skill directory
 * @license MIT
 */

import { resolve } from 'path'
// skill-audit-ignore-next-line
import { writeFile } from 'fs/promises'
import { audit } from '../../index.js'
import { formatReport } from '../../reporter.js'
import { generateHtml } from '../../html-reporter.js'
import { generateMarkdown } from '../../markdown-reporter.js'
import { calculateScore } from '../../scorer.js'
import { diffReports } from '../../diff.js'
import { saveReport, getLatest } from '../../history.js'
import { COLORS } from '../../utils.js'
import { flags, getArg } from '../parser.js'

export async function runScan(target) {
  if (!target || flags.has('--help') || flags.has('-h')) {
    printHelp()
    process.exit(0)
  }

  const jsonMode = flags.has('--json')
  const htmlMode = flags.has('--html')
  const markdownMode = flags.has('--markdown')
  const saveMode = flags.has('--save')
  const diffMode = flags.has('--diff')
  const verboseMode = flags.has('--verbose')
  const quietMode = flags.has('--quiet')
  const exitZero = flags.has('--exit-zero')
  const outputPath = getArg('--output', '-o')
  const langVal = getArg('--lang', null)
  const lang = langVal || 'en'

  const targetPath = resolve(target)

  try {
    const report = await audit(targetPath)
    const scoreResult = calculateScore(report.findings)

    // Load previous report for diff if requested
    let previousReport = null
    if (diffMode) {
      previousReport = await getLatest(targetPath)
      if (!previousReport) {
        console.log(`${COLORS.yellow}⚠ No previous scan found for diff. Run with --save first.${COLORS.reset}`)
      }
    }

    if (quietMode) {
      console.log(`${scoreResult.score}/100 ${scoreResult.grade}`)
    } else if (htmlMode) {
      const html = generateHtml(report, { lang })
      if (outputPath) {
        await writeFile(resolve(outputPath), html, 'utf-8')
        console.log(`${COLORS.green}✓ HTML report written to ${resolve(outputPath)}${COLORS.reset}`)
      } else {
        process.stdout.write(html)
      }
    } else if (markdownMode) {
      const md = generateMarkdown(report, { lang })
      if (outputPath) {
        await writeFile(resolve(outputPath), md, 'utf-8')
        console.log(`${COLORS.green}✓ Markdown report written to ${resolve(outputPath)}${COLORS.reset}`)
      } else {
        process.stdout.write(md)
      }
    } else if (jsonMode) {
      const jsonData = { ...report, score: scoreResult }
      if (previousReport) {
        jsonData.diff = diffReports(previousReport, report)
      }
      const json = JSON.stringify(jsonData, null, 2)
      if (outputPath) {
        await writeFile(resolve(outputPath), json, 'utf-8')
        console.log(`${COLORS.green}✓ JSON report written to ${resolve(outputPath)}${COLORS.reset}`)
      } else {
        console.log(json)
      }
    } else {
      formatReport(report, { lang, previousReport })
      if (verboseMode && report.findings.length > 0) {
        console.log(`  ${COLORS.dim}Rule IDs:${COLORS.reset}`)
        for (const f of report.findings) {
          const color = f.severity === 'danger' ? COLORS.red : COLORS.yellow
          console.log(`    ${color}${f.severity}${COLORS.reset} ${COLORS.dim}${f.file}:${f.line}${COLORS.reset} [${f.rule}]`)
        }
        console.log()
      }
    }

    // Save after display
    if (saveMode) {
      const saved = await saveReport(targetPath, { ...report, score: scoreResult })
      console.log(`${COLORS.green}✓ Scan saved to ${saved.path}${COLORS.reset}`)
    }

    process.exit(exitZero ? 0 : (report.summary.danger > 0 ? 1 : 0))
  } catch (err) {
    console.error(`${COLORS.red}✗ Error: ${err.message}${COLORS.reset}`)
    process.exit(2)
  }
}

function printHelp() {
  console.log(`
  skill-audit — Security scanner for AI agent skills

  Usage:
    skill-audit <path>                        Scan a skill directory
    skill-audit <path> --json                 Output JSON report
    skill-audit <path> --html -o report.html  Output HTML report
    skill-audit <path> --markdown             Output Markdown report
    skill-audit <path> --lang zh              Show fix suggestions in Chinese
    skill-audit <path> --save                 Save scan result to history
    skill-audit <path> --diff                 Compare with last saved scan
    skill-audit history <path>                View scan history
    skill-audit diff <old.json> <new.json>    Compare two report files
    skill-audit serve [--port 3847]           Start API server
    skill-audit badge <path> [-o badge.svg]   Generate SVG badge

  Options:
    --json             Output JSON report
    --html             Output HTML report
    --markdown         Output Markdown report (GitHub-friendly)
    --output, -o FILE  Output file path (used with --html or --json)
    --lang zh          Chinese fix suggestions (default: en)
    --save             Save scan result to .skill-audit/ history
    --diff             Compare with previous scan (auto-loads latest)
    --verbose          Show rule ID for each finding
    --quiet            Output only score and grade (one line)
    --exit-zero        Always exit 0 even if danger findings exist
    -h, --help         Show this help

  Examples:
    skill-audit ./my-skill
    skill-audit ./my-skill --save --diff
    skill-audit ./my-skill --lang zh
    skill-audit ./my-skill --html -o report.html
    skill-audit history ./my-skill
    skill-audit diff old-scan.json new-scan.json
`)
}
