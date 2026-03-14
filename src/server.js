/**
 * Lightweight HTTP API server for skill-audit
 * Pure Node.js — no external dependencies
 *
 * v0.8.0: rate limiting, concurrency control, request IDs,
 *         structured logging, graceful shutdown, /v1/ prefix
 */

import { createServer as httpCreateServer } from 'http';
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve, relative } from 'path';
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
import { sanitizeUrl, hasPathTraversal } from './utils.js';
import { randomUUID } from 'crypto';

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
const REQUEST_TIMEOUT_MS = 30000; // 30s

// Last scan result cache (in-memory, per-process)
let lastScanResult = null;

// ─── Rate Limiter (in-memory, per IP) ───

class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.hits = new Map(); // ip -> { count, resetAt }
  }

  check(ip) {
    const now = Date.now();
    let entry = this.hits.get(ip);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(ip, entry);
    }
    entry.count++;
    if (entry.count > this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }
    return { allowed: true, retryAfter: 0 };
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, entry] of this.hits) {
      if (now >= entry.resetAt) this.hits.delete(ip);
    }
  }
}

// ─── Concurrency Limiter ───

class ConcurrencyLimiter {
  constructor(max = 3) {
    this.max = max;
    this.active = 0;
  }
  acquire() {
    if (this.active >= this.max) return false;
    this.active++;
    return true;
  }
  release() {
    this.active = Math.max(0, this.active - 1);
  }
}

// ─── Structured Logger ───

function structuredLog(entry) {
  process.stderr.write(JSON.stringify(entry) + '\n');
}

// ─── Helpers ───

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(res, status, data, extraHeaders = {}) {
  if (res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json', ...extraHeaders });
  res.end(body);
}

function svgResponse(res, svg) {
  if (res.writableEnded) return;
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

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '0.0.0.0';
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
      const partData = buf.subarray(start, idx - 2);
      parts.push(partData);
    }
    start = idx + boundaryBuf.length;
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;
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

/**
 * Recursively check extracted files for path traversal
 */
async function checkPathTraversal(baseDir) {
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(baseDir, full);
      if (hasPathTraversal(rel)) {
        throw new Error(`Path traversal detected in extracted file: ${rel}`);
      }
      const resolved = resolve(full);
      if (!resolved.startsWith(resolve(baseDir))) {
        throw new Error(`Path traversal detected: file escapes extraction directory`);
      }
      if (entry.isDirectory()) {
        await walk(full);
      }
    }
  }
  await walk(baseDir);
}

async function extractZip(data, destDir) {
  const zipPath = join(destDir, 'upload.zip');
  await writeFile(zipPath, data);
  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir]);
  await checkPathTraversal(destDir);
}

async function extractTarGz(data, destDir) {
  const tarPath = join(destDir, 'upload.tar.gz');
  await writeFile(tarPath, data);
  await execFileAsync('tar', ['-xzf', tarPath, '-C', destDir]);
  await checkPathTraversal(destDir);
}

async function findSkillDir(destDir) {
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

// ─── Route Handlers ───

async function handleScan(req, res, concurrency) {
  if (!concurrency.acquire()) {
    return jsonResponse(res, 503, { error: 'Too many concurrent scans. Try again later.' });
  }
  try {
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
  } finally {
    concurrency.release();
  }
}

async function handleScanUrl(req, res, concurrency) {
  if (!concurrency.acquire()) {
    return jsonResponse(res, 503, { error: 'Too many concurrent scans. Try again later.' });
  }
  try {
    let body;
    try {
      body = await readBody(req, 1024 * 64);
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

    let safeUrl;
    try {
      safeUrl = sanitizeUrl(url);
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message });
    }

    const tmpDir = await mkdtemp(join(tmpdir(), 'skill-audit-'));
    try {
      const cloneDir = join(tmpDir, 'repo');
      await execFileAsync('git', ['clone', '--depth', '1', safeUrl, cloneDir], { timeout: 30000 });
      await checkPathTraversal(cloneDir);
      const skillDir = await findSkillDir(cloneDir);
      const result = await scanAndReport(skillDir);
      jsonResponse(res, 200, result);
    } catch (e) {
      jsonResponse(res, 500, { error: e.message });
    } finally {
      rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } finally {
    concurrency.release();
  }
}

function handleBadge(req, res, url) {
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

// ─── Route matching ───

/** Strip /v1 prefix if present, return normalized path */
function normalizeRoute(url) {
  const path = url.split('?')[0];
  if (path.startsWith('/v1/')) {
    return '/' + path.slice(4);
  }
  return path;
}

// ─── Server Factory ───

export function createServer(options = {}) {
  const rateLimiter = new RateLimiter(
    options.rateLimit ?? 10,
    options.rateWindow ?? 60_000
  );
  const concurrency = new ConcurrencyLimiter(options.maxConcurrent ?? 3);

  // Periodic cleanup every 60s
  const cleanupInterval = setInterval(() => rateLimiter.cleanup(), 60_000);
  cleanupInterval.unref?.();

  // Track in-flight requests for graceful shutdown
  let inFlight = 0;
  let shuttingDown = false;
  let shutdownResolve = null;

  const server = httpCreateServer(async (req, res) => {
    // Reject new requests during shutdown
    if (shuttingDown) {
      res.writeHead(503, { 'Connection': 'close', 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server is shutting down' }));
      return;
    }

    inFlight++;
    const startTime = Date.now();
    const requestId = randomUUID();

    // Set request ID header early
    res.setHeader('X-Request-Id', requestId);

    // Request timeout
    const timeout = setTimeout(() => {
      if (!res.writableEnded) {
        jsonResponse(res, 408, { error: 'Request timeout' });
      }
    }, REQUEST_TIMEOUT_MS);

    // Log + track on finish
    res.on('close', () => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      structuredLog({
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        durationMs,
      });
      inFlight--;
      if (shuttingDown && inFlight === 0 && shutdownResolve) {
        shutdownResolve();
      }
    });

    // CORS preflight (skip rate limit)
    if (req.method === 'OPTIONS') {
      clearTimeout(timeout);
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    // Rate limiting
    const ip = getClientIp(req);
    const rl = rateLimiter.check(ip);
    if (!rl.allowed) {
      clearTimeout(timeout);
      jsonResponse(res, 429, { error: 'Too many requests' }, { 'Retry-After': String(rl.retryAfter) });
      return;
    }

    const url = req.url;
    const method = req.method;
    const route = normalizeRoute(url);

    try {
      if (method === 'POST' && (route === '/api/scan')) {
        await handleScan(req, res, concurrency);
      } else if (method === 'POST' && (route === '/api/scan-url')) {
        await handleScanUrl(req, res, concurrency);
      } else if (method === 'GET' && route.startsWith('/api/badge')) {
        handleBadge(req, res, url);
      } else if (method === 'GET' && (route === '/api/health')) {
        await handleHealth(req, res);
      } else if (method === 'GET' && (route === '/' || route === '/index.html')) {
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
    } finally {
      clearTimeout(timeout);
    }
  });

  // ─── Graceful Shutdown ───

  function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    structuredLog({ timestamp: new Date().toISOString(), event: 'shutdown', signal, inFlight });

    clearInterval(cleanupInterval);
    server.close(); // stop accepting new connections

    const waitForInFlight = new Promise((resolve) => {
      if (inFlight === 0) return resolve();
      shutdownResolve = resolve;
    });

    const forceTimeout = new Promise((resolve) => setTimeout(resolve, 10_000));

    Promise.race([waitForInFlight, forceTimeout]).then(() => {
      structuredLog({ timestamp: new Date().toISOString(), event: 'exit', inFlight });
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Expose internals for testing
  server._rateLimiter = rateLimiter;
  server._concurrency = concurrency;
  server._getShuttingDown = () => shuttingDown;
  server._gracefulShutdown = gracefulShutdown;

  return server;
}
