/**
 * Lightweight HTTP API server for skill-audit
 * Pure Node.js — no external dependencies
 */

import { createServer as httpCreateServer } from 'http';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createGunzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { audit } from './index.js';
import { calculateScore } from './scorer.js';
import { generateBadge } from './badge.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let _version = null;
async function getVersion() {
  if (!_version) {
    const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8'));
    _version = pkg.version;
  }
  return _version;
}

const execFileAsync = promisify(execFile);

const MAX_UPLOAD = 10 * 1024 * 1024; // 10MB

// Last scan result cache (in-memory, per-process)
let lastScanResult = null;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json' });
  res.end(body);
}

function svgResponse(res, svg) {
  res.writeHead(200, {
    ...corsHeaders(),
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'no-cache',
  });
  res.end(svg);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(new Error(`Upload exceeds ${limit} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Parse multipart/form-data — minimal implementation
 * Extracts the first file field's content and filename
 */
function parseMultipart(buf, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (true) {
    const idx = buf.indexOf(boundaryBuf, start);
    if (idx === -1) break;
    if (start > 0) {
      // Extract part between previous boundary and this one
      // Skip \r\n after boundary
      const partData = buf.subarray(start, idx - 2); // -2 for trailing \r\n before boundary
      parts.push(partData);
    }
    start = idx + boundaryBuf.length;
    // Skip \r\n or -- after boundary
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break; // --
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString();
    const body = part.subarray(headerEnd + 4);

    const filenameMatch = headers.match(/filename="([^"]+)"/);
    if (filenameMatch) {
      return { filename: filenameMatch[1], data: body };
    }
  }
  return null;
}

async function extractZip(data, destDir) {
  const zipPath = join(destDir, 'upload.zip');
  await writeFile(zipPath, data);
  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir]);
}

async function extractTarGz(data, destDir) {
  const tarPath = join(destDir, 'upload.tar.gz');
  await writeFile(tarPath, data);
  await execFileAsync('tar', ['-xzf', tarPath, '-C', destDir]);
}

async function findSkillDir(destDir) {
  // If there's a single subdirectory, use that (common for archives/clones)
  const { readdir } = await import('fs/promises');
  const entries = await readdir(destDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
  const files = entries.filter(e => e.isFile() && !['upload.zip', 'upload.tar.gz'].includes(e.name));

  if (dirs.length === 1 && files.length === 0) {
    return join(destDir, dirs[0].name);
  }
  return destDir;
}

async function scanAndReport(skillDir) {
  const report = await audit(skillDir);
  const scoreResult = calculateScore(report.findings);
  const result = { ...report, score: scoreResult };
  lastScanResult = scoreResult;
  return result;
}

async function handleScan(req, res) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return jsonResponse(res, 400, { error: 'Missing multipart boundary' });
  }

  let body;
  try {
    body = await readBody(req, MAX_UPLOAD);
  } catch (e) {
    return jsonResponse(res, 413, { error: e.message });
  }

  const file = parseMultipart(body, boundaryMatch[1]);
  if (!file) {
    return jsonResponse(res, 400, { error: 'No file found in upload' });
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'skill-audit-'));
  try {
    const name = file.filename.toLowerCase();
    if (name.endsWith('.zip')) {
      await extractZip(file.data, tmpDir);
    } else if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
      await extractTarGz(file.data, tmpDir);
    } else {
      return jsonResponse(res, 400, { error: 'Unsupported format. Use .zip or .tar.gz' });
    }

    const skillDir = await findSkillDir(tmpDir);
    const result = await scanAndReport(skillDir);
    jsonResponse(res, 200, result);
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleScanUrl(req, res) {
  let body;
  try {
    body = await readBody(req, 1024 * 64); // 64KB max for JSON body
  } catch (e) {
    return jsonResponse(res, 413, { error: e.message });
  }

  let parsed;
  try {
    parsed = JSON.parse(body.toString());
  } catch {
    return jsonResponse(res, 400, { error: 'Invalid JSON' });
  }

  const { url } = parsed;
  if (!url || typeof url !== 'string') {
    return jsonResponse(res, 400, { error: 'Missing "url" field' });
  }

  // Basic URL validation
  if (!/^https?:\/\/.+/i.test(url)) {
    return jsonResponse(res, 400, { error: 'URL must start with http:// or https://' });
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'skill-audit-'));
  try {
    const cloneDir = join(tmpDir, 'repo');
    await execFileAsync('git', ['clone', '--depth', '1', url, cloneDir], { timeout: 30000 });
    const skillDir = await findSkillDir(cloneDir);
    const result = await scanAndReport(skillDir);
    jsonResponse(res, 200, result);
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function handleBadge(req, res, url) {
  // Parse query params for score/grade override
  const qIdx = url.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? url.slice(qIdx) : '');

  let score = lastScanResult?.score ?? 0;
  let grade = lastScanResult?.grade ?? 'F';

  if (params.has('score')) score = Math.max(0, Math.min(100, parseInt(params.get('score'), 10) || 0));
  if (params.has('grade')) grade = params.get('grade').toUpperCase();

  const svg = generateBadge(score, grade);
  svgResponse(res, svg);
}

async function handleHealth(req, res) {
  const version = await getVersion();
  jsonResponse(res, 200, { status: 'ok', version, uptime: process.uptime() });
}

export function createServer(options = {}) {
  const server = httpCreateServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    const url = req.url;
    const method = req.method;

    try {
      if (method === 'POST' && url === '/api/scan') {
        await handleScan(req, res);
      } else if (method === 'POST' && url === '/api/scan-url') {
        await handleScanUrl(req, res);
      } else if (method === 'GET' && url.startsWith('/api/badge')) {
        handleBadge(req, res, url);
      } else if (method === 'GET' && url === '/api/health') {
        await handleHealth(req, res);
      } else if (method === 'GET' && (url === '/' || url === '/index.html')) {
        // Serve web frontend
        const webDir = join(__dirname, '..', 'web');
        try {
          const html = await readFile(join(webDir, 'index.html'), 'utf-8');
          res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch {
          jsonResponse(res, 404, { error: 'Web frontend not found' });
        }
      } else {
        jsonResponse(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      jsonResponse(res, 500, { error: e.message });
    }
  });

  return server;
}
