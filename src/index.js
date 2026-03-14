import { readdir, readFile, stat, lstat } from 'fs/promises';
import { join, extname, relative } from 'path';
import { dangerousCommands } from './rules/dangerous-commands.js';
import { secretLeaks } from './rules/secret-leaks.js';
import { promptInjection } from './rules/prompt-injection.js';
import { suspiciousNetwork } from './rules/suspicious-network.js';
import { permissionAudit } from './rules/permission-audit.js';
import { dependencyAudit } from './rules/dependency-audit.js';
import { fileSystemAudit } from './rules/file-system-audit.js';
import { encodingAudit } from './rules/encoding-audit.js';
import { supplyChainAudit } from './rules/supply-chain-audit.js';
import { sandboxEscape } from './rules/sandbox-escape.js';
import { configAudit } from './rules/config-audit.js';
import { parseManifest } from './parsers/index.js';

const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.py', '.sh', '.bash', '.zsh',
  '.md', '.txt', '.yaml', '.yml', '.json', '.toml',
  '.prompt', '.jinja', '.jinja2', '.hbs', '.ejs',
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB per file
const BATCH_SIZE = 10;
const MAX_FILE_COUNT = 1000;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

const IGNORE_COMMENT_RE = /(?:\/\/|#)\s*skill-audit-ignore-next-line/;

async function collectFiles(dir, base = dir, ctx = null) {
  // Initialize context on first call
  if (!ctx) {
    ctx = { visitedInodes: new Set(), fileCount: 0, totalSize: 0 };
  }

  // Symlink loop detection for the directory itself
  try {
    const dirStats = await lstat(dir);
    const inodeKey = `${dirStats.dev}:${dirStats.ino}`;
    if (ctx.visitedInodes.has(inodeKey)) {
      console.warn(`⚠ Symlink loop detected, skipping: ${dir}`);
      return [];
    }
    ctx.visitedInodes.add(inodeKey);
  } catch {
    // If we can't stat the dir, let readdir fail naturally
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    if (entry.isSymbolicLink()) {
      // Check symlink target for loops
      try {
        const linkStats = await stat(full); // follows symlink
        const linkInode = `${linkStats.dev}:${linkStats.ino}`;
        if (ctx.visitedInodes.has(linkInode)) {
          console.warn(`⚠ Symlink loop detected, skipping: ${full}`);
          continue;
        }
        if (linkStats.isDirectory()) {
          ctx.visitedInodes.add(linkInode);
          files.push(...await collectFiles(full, base, ctx));
          continue;
        }
        // Symlink to file — fall through to file handling below
      } catch {
        // Broken symlink — skip
        continue;
      }
    }

    if (entry.isDirectory()) {
      files.push(...await collectFiles(full, base, ctx));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      const ext = extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext) || entry.name === 'SKILL.md' || entry.name === 'Dockerfile') {
        const s = await stat(full);
        if (s.size <= MAX_FILE_SIZE) {
          ctx.fileCount++;
          ctx.totalSize += s.size;

          if (ctx.fileCount > MAX_FILE_COUNT) {
            throw new Error(`Too many files: exceeded limit of ${MAX_FILE_COUNT} scannable files`);
          }
          if (ctx.totalSize > MAX_TOTAL_SIZE) {
            throw new Error(`Total size too large: exceeded limit of ${MAX_TOTAL_SIZE / (1024 * 1024)}MB`);
          }

          files.push({ path: full, rel: relative(base, full), ext });
        }
      }
    }
  }
  return files;
}

/**
 * Pre-process file content to mark lines that should be ignored.
 * Returns a Set of 1-based line numbers to skip.
 */
function getIgnoredLines(content) {
  const ignored = new Set();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (IGNORE_COMMENT_RE.test(lines[i])) {
      // The NEXT line (i+1 in 0-based = line i+2 in 1-based) should be ignored
      ignored.add(i + 2);
    }
  }
  return ignored;
}

/**
 * Filter findings to remove those on ignored lines
 */
function applyIgnoreFilter(findings, ignoredLines) {
  if (ignoredLines.size === 0) return findings;
  return findings.filter(f => !ignoredLines.has(f.line));
}

const rules = [dangerousCommands, secretLeaks, promptInjection, suspiciousNetwork, permissionAudit, dependencyAudit, fileSystemAudit, encodingAudit, supplyChainAudit, sandboxEscape, configAudit];

/**
 * Scan a skill directory for security issues.
 *
 * Reads all supported files, runs all built-in rules (and plugin rules if configured),
 * and returns a structured report with findings, summary, timing, and optional manifest info.
 *
 * @param {string} targetPath - Absolute path to the skill directory to scan
 * @returns {Promise<{
 *   target: string,
 *   files: string[],
 *   findings: Array<{rule: string, severity: 'danger'|'warn', file: string, line: number, msg: string, snippet: string, fix?: string}>,
 *   summary: {pass: number, warn: number, danger: number, files: number},
 *   timing: {totalMs: number, filesMs: number, rulesMs: number},
 *   manifest?: {format: string, name: string, description: string, declaredPermissions: string[]}
 * }>}
 * @throws {Error} If targetPath is not a directory or contains no scannable files
 */
export async function audit(targetPath) {
  const totalStart = performance.now();

  const s = await stat(targetPath);
  if (!s.isDirectory()) throw new Error(`${targetPath} is not a directory`);

  const files = await collectFiles(targetPath);
  if (files.length === 0) throw new Error('No scannable files found');

  // Parse manifest (non-blocking — returns null if format unknown)
  let manifest = null;
  try {
    manifest = await parseManifest(targetPath);
  } catch {
    // Manifest parsing failure is non-fatal
  }

  // Read files in parallel batches of BATCH_SIZE
  const filesStart = performance.now();
  const fileContents = new Array(files.length);
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const contents = await Promise.all(batch.map(f => readFile(f.path, 'utf-8')));
    for (let j = 0; j < contents.length; j++) {
      fileContents[i + j] = contents[j];
    }
  }
  const filesMs = performance.now() - filesStart;

  // Pre-compute ignored lines per file
  const ignoredLinesPerFile = fileContents.map(c => getIgnoredLines(c));

  // Run all rules per file in parallel (each file's rules run concurrently)
  const rulesStart = performance.now();
  const allFileFindings = await Promise.all(
    files.map((file, idx) => {
      const content = fileContents[idx];
      const ruleResults = rules.map(rule => rule.scan(content, file, { manifest }));
      return Promise.all(ruleResults.map(r => Promise.resolve(r)));
    })
  );
  const rulesMs = performance.now() - rulesStart;

  // Flatten and apply ignore filters
  const findings = [];
  for (let i = 0; i < allFileFindings.length; i++) {
    const fileFindings = allFileFindings[i].flat();
    const filtered = applyIgnoreFilter(fileFindings, ignoredLinesPerFile[i]);
    findings.push(...filtered);
  }

  // Post-scan: manifest comparison for permission audit
  if (manifest && permissionAudit.compareManifest) {
    const manifestFindings = permissionAudit.compareManifest(manifest, findings);
    findings.push(...manifestFindings);
  }

  const summary = { pass: 0, warn: 0, danger: 0, files: files.length };
  for (const f of findings) {
    summary[f.severity]++;
  }
  if (findings.length === 0) summary.pass = 1;

  const totalMs = performance.now() - totalStart;

  const report = {
    target: targetPath,
    files: files.map(f => f.rel),
    findings: findings.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity)),
    summary,
    timing: {
      totalMs: Math.round(totalMs * 100) / 100,
      filesMs: Math.round(filesMs * 100) / 100,
      rulesMs: Math.round(rulesMs * 100) / 100,
    },
  };

  // Include manifest info if available
  if (manifest) {
    report.manifest = {
      format: manifest.format,
      name: manifest.name,
      description: manifest.description,
      declaredPermissions: manifest.declaredPermissions,
    };
  }

  return report;
}

function severityOrder(s) {
  return s === 'danger' ? 3 : s === 'warn' ? 2 : 1;
}
