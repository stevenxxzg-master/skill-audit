import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodingAudit } from '../src/rules/encoding-audit.js';

function scan(content, filename = 'test.js') {
  return encodingAudit.scan(content, { rel: filename, ext: '.js' }, {});
}

describe('encoding-audit rule', () => {
  it('has correct id', () => {
    assert.equal(encodingAudit.id, 'encoding-audit');
  });

  // ─── Unicode direction control characters ───

  describe('Unicode direction control characters', () => {
    it('detects RLO (U+202E)', () => {
      const content = 'const x = "\u202Emalicious";';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect RLO');
      assert.ok(hits.some(h => h.rule.includes('encoding-audit')));
      assert.ok(hits.some(h => h.severity === 'danger'));
    });

    it('detects LRO (U+202D)', () => {
      const content = 'const x = "\u202Dhidden";';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect LRO');
    });

    it('detects RLI (U+2067)', () => {
      const content = 'const x = "\u2067sneaky";';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect RLI');
    });

    it('detects LRI (U+2066)', () => {
      const content = 'const x = "\u2066text";';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect LRI');
    });
  });

  // ─── Zero-width characters ───

  describe('Zero-width characters', () => {
    it('detects zero-width space (U+200B)', () => {
      const content = 'const pa\u200Bssword = "secret";';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect zero-width space');
    });

    it('detects zero-width non-joiner (U+200C)', () => {
      const content = 'eval\u200C("code");';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect ZWNJ');
    });

    it('detects zero-width joiner (U+200D)', () => {
      const content = 'require\u200D("fs");';
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect ZWJ');
    });
  });

  // ─── Base64 suspicious content ───

  describe('Base64 suspicious content', () => {
    it('detects base64-encoded eval/exec patterns', () => {
      // eval("malicious_code_that_does_bad_things_and_is_long_enough") in base64
      const b64 = 'ZXZhbCgibWFsaWNpb3VzX2NvZGVfdGhhdF9kb2VzX2JhZF90aGluZ3NfYW5kX2lzX2xvbmdfZW5vdWdoIik=';
      const content = `const payload = "${b64}";`;
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should detect suspicious base64');
    });

    it('detects long base64 strings (potential obfuscated code)', () => {
      // A long base64 string that could be obfuscated code
      const longB64 = Buffer.from('x'.repeat(200)).toString('base64');
      const content = `const data = "${longB64}";`;
      const hits = scan(content);
      assert.ok(hits.length > 0, 'should flag long base64 strings');
    });
  });

  // ─── No false positives ───

  describe('no false positives', () => {
    it('clean JavaScript file passes', () => {
      const content = `
import { readFile } from 'fs/promises';

export async function loadConfig(path) {
  const data = await readFile(path, 'utf-8');
  return JSON.parse(data);
}
`;
      const hits = scan(content);
      assert.equal(hits.length, 0, 'clean file should have no findings');
    });

    it('normal short base64 (like small icons) is not flagged', () => {
      const content = 'const icon = "aWNvbg==";'; // "icon" in base64
      const hits = scan(content);
      assert.equal(hits.length, 0, 'short harmless base64 should not trigger');
    });

    it('normal markdown file passes', () => {
      const content = `# My Skill\n\nThis skill does useful things.\n\n## Usage\n\nRun it with \`node index.js\`.\n`;
      const hits = scan(content, 'README.md');
      assert.equal(hits.length, 0);
    });
  });
});
