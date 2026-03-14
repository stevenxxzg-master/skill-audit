import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, sanitizeUrl, hasPathTraversal } from '../src/utils.js';

describe('isPrivateIp()', () => {
  it('detects 10.x.x.x', () => {
    assert.ok(isPrivateIp('10.0.0.1'));
    assert.ok(isPrivateIp('10.255.255.255'));
  });

  it('detects 172.16-31.x.x', () => {
    assert.ok(isPrivateIp('172.16.0.1'));
    assert.ok(isPrivateIp('172.31.255.255'));
    assert.ok(!isPrivateIp('172.15.0.1'));
    assert.ok(!isPrivateIp('172.32.0.1'));
  });

  it('detects 192.168.x.x', () => {
    assert.ok(isPrivateIp('192.168.0.1'));
    assert.ok(isPrivateIp('192.168.255.255'));
  });

  it('detects 127.x.x.x', () => {
    assert.ok(isPrivateIp('127.0.0.1'));
    assert.ok(isPrivateIp('127.255.255.255'));
  });

  it('detects 0.0.0.0', () => {
    assert.ok(isPrivateIp('0.0.0.0'));
  });

  it('detects localhost', () => {
    assert.ok(isPrivateIp('localhost'));
    assert.ok(isPrivateIp('LOCALHOST'));
  });

  it('detects ::1', () => {
    assert.ok(isPrivateIp('::1'));
  });

  it('returns false for public IPs', () => {
    assert.ok(!isPrivateIp('8.8.8.8'));
    assert.ok(!isPrivateIp('1.1.1.1'));
    assert.ok(!isPrivateIp('203.0.113.1'));
  });

  it('returns false for null/empty/non-string', () => {
    assert.ok(!isPrivateIp(null));
    assert.ok(!isPrivateIp(''));
    assert.ok(!isPrivateIp(undefined));
  });

  it('returns false for hostnames', () => {
    assert.ok(!isPrivateIp('example.com'));
    assert.ok(!isPrivateIp('github.com'));
  });
});

describe('sanitizeUrl()', () => {
  it('accepts valid https URL', () => {
    assert.equal(sanitizeUrl('https://github.com/repo'), 'https://github.com/repo');
  });

  it('accepts valid http URL', () => {
    assert.equal(sanitizeUrl('http://example.com/path'), 'http://example.com/path');
  });

  it('rejects file:// URLs', () => {
    assert.throws(() => sanitizeUrl('file:///etc/passwd'), /file:\/\//);
  });

  it('rejects non-http URLs', () => {
    assert.throws(() => sanitizeUrl('ftp://example.com'), /http.*https/);
  });

  it('rejects URLs with command injection chars', () => {
    assert.throws(() => sanitizeUrl('https://evil.com; rm -rf /'), /dangerous/i);
    assert.throws(() => sanitizeUrl('https://evil.com | cat'), /dangerous/i);
    assert.throws(() => sanitizeUrl('https://evil.com & bg'), /dangerous/i);
    assert.throws(() => sanitizeUrl('https://evil.com`whoami`'), /dangerous/i);
    assert.throws(() => sanitizeUrl('https://evil.com$(id)'), /dangerous/i);
  });

  it('rejects URLs pointing to private IPs', () => {
    assert.throws(() => sanitizeUrl('https://192.168.1.1/api'), /private/i);
    assert.throws(() => sanitizeUrl('https://10.0.0.1/api'), /private/i);
    assert.throws(() => sanitizeUrl('https://127.0.0.1/api'), /private/i);
    assert.throws(() => sanitizeUrl('http://localhost:3000'), /private/i);
  });

  it('rejects null/empty', () => {
    assert.throws(() => sanitizeUrl(null), /required/i);
    assert.throws(() => sanitizeUrl(''), /required/i);
  });
});

describe('hasPathTraversal()', () => {
  it('detects .. in path', () => {
    assert.ok(hasPathTraversal('../etc/passwd'));
    assert.ok(hasPathTraversal('foo/../../etc'));
    assert.ok(hasPathTraversal('..\\windows\\system32'));
  });

  it('returns false for safe paths', () => {
    assert.ok(!hasPathTraversal('foo/bar/baz'));
    assert.ok(!hasPathTraversal('src/index.js'));
    assert.ok(!hasPathTraversal(''));
  });

  it('returns false for null/undefined', () => {
    assert.ok(!hasPathTraversal(null));
    assert.ok(!hasPathTraversal(undefined));
  });
});
