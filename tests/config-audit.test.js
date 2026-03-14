import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { configAudit } from '../src/rules/config-audit.js';

function scan(content, filename = 'config.yaml', ext = '.yaml') {
  return configAudit.scan(content, { rel: filename, ext }, {});
}

describe('config-audit rule', () => {
  it('has correct id', () => {
    assert.equal(configAudit.id, 'config-audit');
  });

  // ─── Debug mode ───

  describe('debug mode', () => {
    it('detects debug: true in YAML', () => {
      const hits = scan('debug: true');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/debug-enabled'));
    });

    it('detects debug = true in config', () => {
      const hits = scan('debug = true', 'app.toml', '.toml');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/debug-enabled'));
    });

    it('detects debug: enabled', () => {
      const hits = scan('debug: enabled');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/debug-enabled'));
    });

    it('detects verbose: true', () => {
      const hits = scan('verbose: true');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/verbose-logging'));
    });
  });

  // ─── CORS wildcard ───

  describe('CORS wildcard', () => {
    it('detects Access-Control-Allow-Origin: *', () => {
      const hits = scan('Access-Control-Allow-Origin: *');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/cors-wildcard'));
    });

    it('detects CORS wildcard in JS header assignment', () => {
      const hits = scan("const cors = 'Access-Control-Allow-Origin: *';", 'server.js', '.js');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/cors-wildcard'));
    });
  });

  // ─── TLS/SSL disabled ───

  describe('TLS/SSL disabled', () => {
    it('detects rejectUnauthorized: false', () => {
      const hits = scan('rejectUnauthorized: false');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/tls-reject-disabled'));
      assert.ok(hits.some(h => h.severity === 'danger'));
    });

    it('detects verify: false', () => {
      const hits = scan('verify: false');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/ssl-verify-disabled'));
    });

    it('detects NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
      const hits = scan('NODE_TLS_REJECT_UNAUTHORIZED=0');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/node-tls-disabled'));
      assert.ok(hits.some(h => h.severity === 'danger'));
    });

    it('detects NODE_TLS_REJECT_UNAUTHORIZED="0"', () => {
      const hits = scan('NODE_TLS_REJECT_UNAUTHORIZED="0"');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/node-tls-disabled'));
    });
  });

  // ─── Insecure HTTP ───

  describe('insecure HTTP protocol', () => {
    it('detects http:// in config file', () => {
      const hits = scan('api_url: "http://production.example.com/api"');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'config-audit/insecure-http'));
    });

    it('skips http://localhost', () => {
      const hits = scan('url: "http://localhost:3000"');
      assert.equal(hits.filter(h => h.rule === 'config-audit/insecure-http').length, 0);
    });

    it('skips http://127.0.0.1', () => {
      const hits = scan('url: "http://127.0.0.1:8080"');
      assert.equal(hits.filter(h => h.rule === 'config-audit/insecure-http').length, 0);
    });

    it('does not flag http in non-config JS without config context', () => {
      const hits = scan('const x = "http://example.com";', 'app.js', '.js');
      assert.equal(hits.filter(h => h.rule === 'config-audit/insecure-http').length, 0);
    });

    it('flags http in JS with config context', () => {
      const hits = scan('const baseUrl = "http://production.example.com/api";', 'app.js', '.js');
      assert.ok(hits.some(h => h.rule === 'config-audit/insecure-http'));
    });
  });

  // ─── No false positives ───

  describe('no false positives', () => {
    it('clean config passes', () => {
      const content = `name: my-skill
version: 1.0.0
description: A safe skill
`;
      const hits = scan(content);
      assert.equal(hits.length, 0);
    });

    it('debug: false is not flagged', () => {
      const hits = scan('debug: false');
      assert.equal(hits.length, 0);
    });

    it('https URL is not flagged', () => {
      const hits = scan('api_url: "https://api.example.com"');
      assert.equal(hits.filter(h => h.rule === 'config-audit/insecure-http').length, 0);
    });
  });
});
