import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

describe('Rate limiting', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Low limit for testing: 3 req/min
    server = createServer({ rateLimit: 3, rateWindow: 60_000 });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('allows requests within the limit then returns 429', async () => {
    // First 3 should succeed
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200, `request ${i + 1} should succeed`);
    }

    // 4th should be rate limited
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 429);
    const data = await res.json();
    assert.ok(data.error.includes('Too many'));
    const retryAfter = res.headers.get('retry-after');
    assert.ok(retryAfter, 'should have Retry-After header');
    assert.ok(parseInt(retryAfter, 10) > 0, 'Retry-After should be positive');
  });

  it('429 response still includes X-Request-Id', async () => {
    // Already over limit from previous test
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 429);
    assert.ok(res.headers.get('x-request-id'), 'should have X-Request-Id even on 429');
  });
});

describe('Concurrency limiting', () => {
  it('returns 503 when too many concurrent scans', async () => {
    // Use maxConcurrent=1 and a high rate limit
    const server = createServer({ rateLimit: 100, maxConcurrent: 1 });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // Manually set concurrency to full so next scan gets 503
    server._concurrency.active = 1;

    const body = JSON.stringify({ url: 'https://example.com/test.git' });
    const res = await fetch(`${baseUrl}/api/scan-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    assert.equal(res.status, 503);
    const data = await res.json();
    assert.ok(data.error.includes('concurrent'));

    // Cleanup
    server._concurrency.active = 0;
    await new Promise((resolve) => server.close(resolve));
  });
});
