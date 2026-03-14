import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, relative } from 'path';
import { dangerousCommands } from './rules/dangerous-commands.js';
import { secretLeaks } from './rules/secret-leaks.js';
import { promptInjection } from './rules/prompt-injection.js';
import { suspiciousNetwork } from './rules/suspicious-network.js';
import { permissionAudit } from './rules/permission-audit.js';
import { dependencyAudit } from './rules/dependency-audit.js';
import { fileSystemAudit } from './rules/file-system-audit.js';

const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.py', '.sh', '.bash', '.zsh',
  '.md', '.txt', '.yaml', '.yml', '.json', '.toml',
  '.prompt', '.jinja', '.jinja2', '.hbs', '.ejs',
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB

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

const rules = [dangerousCommands, secretLeaks, promptInjection, suspiciousNetwork, permissionAudit, dependencyAudit, fileSystemAudit];

export async function audit(targetPath) {
  const s = await stat(targetPath);
  if (!s.isDirectory()) throw new Error(`${targetPath} is not a directory`);

  const files = await collectFiles(targetPath);
  if (files.length === 0) throw new Error('No scannable files found');

  const findings = [];

  for (const file of files) {
    const content = await readFile(file.path, 'utf-8');
    for (const rule of rules) {
      const hits = rule.scan(content, file);
      findings.push(...hits);
    }
  }

  const summary = { pass: 0, warn: 0, danger: 0, files: files.length };
  for (const f of findings) {
    summary[f.severity]++;
  }
  if (findings.length === 0) summary.pass = 1;

  return {
    target: targetPath,
    files: files.map(f => f.rel),
    findings: findings.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity)),
    summary,
  };
}

function severityOrder(s) {
  return s === 'danger' ? 3 : s === 'warn' ? 2 : 1;
}
