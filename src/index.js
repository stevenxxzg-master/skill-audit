import { readdir, readFile, stat } from 'fs/promises';
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
import { parseManifest } from './parsers/index.js';

const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.py', '.sh', '.bash', '.zsh',
  '.md', '.txt', '.yaml', '.yml', '.json', '.toml',
  '.prompt', '.jinja', '.jinja2', '.hbs', '.ejs',
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB
const BATCH_SIZE = 10;

async function collectFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full, base));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext) || entry.name === 'SKILL.md' || entry.name === 'Dockerfile') {
        const s = await stat(full);
        if (s.size <= MAX_FILE_SIZE) {
          files.push({ path: full, rel: relative(base, full), ext });
        }
      }
    }
  }
  return files;
}

const rules = [dangerousCommands, secretLeaks, promptInjection, suspiciousNetwork, permissionAudit, dependencyAudit, fileSystemAudit, encodingAudit, supplyChainAudit];

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

  const findings = allFileFindings.flat(2);

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
