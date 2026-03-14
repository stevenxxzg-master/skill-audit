import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { generateBadge } from '../src/badge.js';

// ─── Badge SVG unit tests ───

describe('generateBadge()', () => {
  it('returns valid SVG string', () => {
    const svg = generateBadge(100, 'A');
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('</svg>'));
  });

  it('contains score and grade text', () => {
    const svg = generateBadge(75, 'B');
    assert.ok(svg.includes('B 75'), 'should contain grade and score');
    assert.ok(svg.includes('skill-audit'), 'should contain label');
  });

  it('uses correct color for each grade', () => {
    assert.ok(generateBadge(95, 'A').includes('#4c1'));
    assert.ok(generateBadge(75, 'B').includes('#97ca00'));
    assert.ok(generateBadge(55, 'C').includes('#dfb317'));
    assert.ok(generateBadge(35, 'D').includes('#fe7d37'));
    assert.ok(generateBadge(10, 'F').includes('#e05d44'));
  });

  it('has proper aria-label for accessibility', () => {
    const svg = generateBadge(90, 'A');
    assert.ok(svg.includes('aria-label="skill-audit: A 90"'));
  });
});

// ─── HTTP API tests ───

describe('API server', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createServer();
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.ok(typeof data.uptime === 'number');
    assert.ok('version' in data);
  });

  it('POST /api/scan without multipart boundary returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'not-multipart',
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('boundary'));
  });

  it('POST /api/scan with multipart but no file returns 400', async () => {
    const boundary = '----TestBoundary123';
    const body = `------TestBoundary123\r\nContent-Disposition: form-data; name="text"\r\n\r\nhello\r\n------TestBoundary123--\r\n`;
    const res = await fetch(`${baseUrl}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=----TestBoundary123` },
      body,
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('No file'));
  });

  it('GET /api/badge returns SVG', async () => {
    const res = await fetch(`${baseUrl}/api/badge?score=85&grade=B`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/svg+xml');
    const svg = await res.text();
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('B 85'));
  });

  it('GET /api/badge with no params returns default SVG', async () => {
    const res = await fetch(`${baseUrl}/api/badge`);
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.ok(svg.includes('<svg'));
  });

  it('unknown route returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('OPTIONS returns CORS headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-origin'));
  });
});
