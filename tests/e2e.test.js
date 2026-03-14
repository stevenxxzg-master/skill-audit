import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'child_process'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync, unlinkSync, mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cli = resolve(__dirname, '..', 'bin', 'cli.js')
const fixtures = join(__dirname, 'fixtures')
const projectRoot = resolve(__dirname, '..')

function run(args, opts = {}) {
  return execFileSync('node', [cli, ...args], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: opts.cwd || projectRoot,
    ...opts,
  })
}

function runWithStatus(args, opts = {}) {
  try {
    const stdout = run(args, opts)
    return { stdout, exitCode: 0 }
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status }
  }
}

describe('E2E: CLI full flow', () => {
  it('scans a clean fixture and outputs text report', () => {
    const result = runWithStatus([join(fixtures, 'clean-skill')])
    assert.equal(result.exitCode, 0)
    assert.ok(result.stdout.includes('100') || result.stdout.includes('A'), 'Should show score or grade')
  })

  it('scans and outputs JSON with score', () => {
    const result = runWithStatus([join(fixtures, 'clean-skill'), '--json'])
    assert.equal(result.exitCode, 0)
    const report = JSON.parse(result.stdout)
    assert.ok(report.score, 'JSON output should include score')
    assert.equal(typeof report.score.score, 'number')
    assert.equal(typeof report.score.grade, 'string')
    assert.ok(Array.isArray(report.findings))
    assert.ok(Array.isArray(report.files))
    assert.ok(report.summary)
  })

  it('scans a dirty fixture and returns non-zero exit', () => {
    const result = runWithStatus([join(fixtures, 'evil-skill')])
    assert.notEqual(result.exitCode, 0, 'Should exit non-zero for danger findings')
  })

  it('--exit-zero forces exit 0 even with danger findings', () => {
    const result = runWithStatus([join(fixtures, 'evil-skill'), '--exit-zero'])
    assert.equal(result.exitCode, 0)
  })
})

describe('E2E: output formats', () => {
  it('generates HTML output', () => {
    const outPath = join(tmpdir(), `skill-audit-e2e-${Date.now()}.html`)
    try {
      const result = runWithStatus([join(fixtures, 'clean-skill'), '--html', '-o', outPath])
      assert.equal(result.exitCode, 0)
      assert.ok(existsSync(outPath), 'HTML file should be created')
      const html = readFileSync(outPath, 'utf-8')
      assert.ok(html.includes('<html') || html.includes('<!DOCTYPE'), 'Should be valid HTML')
      assert.ok(html.includes('skill-audit'), 'Should contain skill-audit branding')
    } finally {
      try { unlinkSync(outPath) } catch {}
    }
  })

  it('generates Markdown output', () => {
    const outPath = join(tmpdir(), `skill-audit-e2e-${Date.now()}.md`)
    try {
      const result = runWithStatus([join(fixtures, 'clean-skill'), '--markdown', '-o', outPath])
      assert.equal(result.exitCode, 0)
      assert.ok(existsSync(outPath), 'Markdown file should be created')
      const md = readFileSync(outPath, 'utf-8')
      assert.ok(md.includes('#') || md.includes('score'), 'Should contain markdown content')
    } finally {
      try { unlinkSync(outPath) } catch {}
    }
  })

  it('generates JSON output to file', () => {
    const outPath = join(tmpdir(), `skill-audit-e2e-${Date.now()}.json`)
    try {
      const result = runWithStatus([join(fixtures, 'clean-skill'), '--json', '-o', outPath])
      assert.equal(result.exitCode, 0)
      assert.ok(existsSync(outPath), 'JSON file should be created')
      const data = JSON.parse(readFileSync(outPath, 'utf-8'))
      assert.ok(data.score)
    } finally {
      try { unlinkSync(outPath) } catch {}
    }
  })
})

describe('E2E: CLI modes', () => {
  it('--quiet outputs only score and grade', () => {
    const result = runWithStatus([join(fixtures, 'clean-skill'), '--quiet'])
    assert.equal(result.exitCode, 0)
    const line = result.stdout.trim()
    // Should match pattern like "100/100 A"
    assert.match(line, /^\d+\/100\s+[A-F]$/, `Quiet output should be "score/100 grade", got: "${line}"`)
  })

  it('--verbose shows rule IDs', () => {
    const result = runWithStatus([join(fixtures, 'evil-skill'), '--verbose', '--exit-zero'])
    assert.equal(result.exitCode, 0)
    // Verbose mode should show rule IDs in brackets
    assert.ok(
      result.stdout.includes('[') || result.stdout.includes('Rule IDs'),
      'Verbose output should include rule IDs'
    )
  })
})

describe('E2E: badge generation', () => {
  it('generates SVG badge via badge subcommand', () => {
    const outPath = join(tmpdir(), `skill-audit-badge-${Date.now()}.svg`)
    try {
      const result = runWithStatus(['badge', join(fixtures, 'clean-skill'), '-o', outPath])
      assert.equal(result.exitCode, 0)
      assert.ok(existsSync(outPath), 'Badge SVG should be created')
      const svg = readFileSync(outPath, 'utf-8')
      assert.ok(svg.includes('<svg'), 'Should be valid SVG')
      assert.ok(svg.includes('100') || svg.includes('A'), 'Should contain score or grade')
    } finally {
      try { unlinkSync(outPath) } catch {}
    }
  })

  it('outputs SVG to stdout when no -o flag', () => {
    const result = runWithStatus(['badge', join(fixtures, 'clean-skill')])
    assert.equal(result.exitCode, 0)
    assert.ok(result.stdout.includes('<svg'), 'Should output SVG to stdout')
  })
})

describe('E2E: dogfooding (scan self)', () => {
  it('scans the skill-audit project itself', () => {
    const result = runWithStatus([projectRoot, '--json'])
    // Should complete without crashing
    assert.ok(result.exitCode === 0 || result.exitCode === 1, `Exit code should be 0 or 1, got ${result.exitCode}`)
    const report = JSON.parse(result.stdout)
    assert.ok(report.score, 'Should have score')
    assert.ok(report.score.score >= 90, `Self-scan score should be >= 90 (A grade), got ${report.score.score}`)
    assert.equal(report.score.grade, 'A', `Self-scan grade should be A, got ${report.score.grade}`)
  })

  it('self-scan quiet mode works', () => {
    const result = runWithStatus([projectRoot, '--quiet'])
    assert.equal(result.exitCode, 0)
    const line = result.stdout.trim()
    assert.match(line, /^\d+\/100\s+[A-F]$/)
  })
})

describe('E2E: .skillauditignore support', () => {
  it('respects .skillauditignore file', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'skill-audit-ignore-test-'))
    try {
      // Create a skill with a dangerous file and an ignore file
      mkdirSync(join(tmpDir, 'src'), { recursive: true })
      writeFileSync(join(tmpDir, 'SKILL.md'), '# Test Skill\nA test skill.')
      writeFileSync(join(tmpDir, 'src', 'main.js'), 'console.log("clean")')
      writeFileSync(join(tmpDir, 'dangerous.js'), 'eval("malicious code")')
      writeFileSync(join(tmpDir, '.skillauditignore'), 'dangerous.js\n')

      const result = runWithStatus([tmpDir, '--json'])
      const report = JSON.parse(result.stdout)
      // The dangerous.js file should be excluded
      assert.ok(!report.files.includes('dangerous.js'), 'dangerous.js should be ignored')
    } finally {
      try { execFileSync('rm', ['-rf', tmpDir]) } catch {}
    }
  })
})
