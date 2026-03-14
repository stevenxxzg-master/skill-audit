import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSuggestion } from '../src/fixer.js';

// All known rule IDs from the SUGGESTIONS map in fixer.js
const KNOWN_RULE_IDS = [
  'dangerous-commands/rm-force',
  'dangerous-commands/rm-recursive',
  'dangerous-commands/eval',
  'dangerous-commands/exec-call',
  'dangerous-commands/child-process',
  'dangerous-commands/subprocess',
  'dangerous-commands/os-system',
  'dangerous-commands/chmod-world',
  'dangerous-commands/kill-9',
  'dangerous-commands/mkfs',
  'dangerous-commands/dd',
  'dangerous-commands/dev-write',
  'dangerous-commands/function-constructor',
  'dangerous-commands/dunder-import',
  'dangerous-commands/importlib',
  'secret-leaks/api-key',
  'secret-leaks/secret',
  'secret-leaks/token',
  'secret-leaks/aws-key',
  'secret-leaks/openai-key',
  'secret-leaks/github-token',
  'secret-leaks/gitlab-token',
  'secret-leaks/slack-token',
  'secret-leaks/private-key',
  'secret-leaks/db-uri',
  'secret-leaks/bearer-token',
  'prompt-injection/ignore-prev',
  'prompt-injection/role-override',
  'prompt-injection/disregard',
  'prompt-injection/forget',
  'prompt-injection/fake-system',
  'prompt-injection/jailbreak',
  'prompt-injection/disobey',
  'prompt-injection/pretend-no-rules',
  'prompt-injection/special-tokens',
  'prompt-injection/llama-sys',
  'prompt-injection/act-as',
  'suspicious-network/curl-pipe-shell',
  'suspicious-network/wget-pipe-shell',
  'suspicious-network/curl-post',
  'suspicious-network/fetch-post',
  'suspicious-network/requests-post',
  'suspicious-network/raw-ip',
  'suspicious-network/tunnel',
  'suspicious-network/paste-service',
  'suspicious-network/webhook-test',
  'suspicious-network/dns-override',
  'permission-audit/filesystem',
  'permission-audit/network',
  'permission-audit/exec',
  'permission-audit/env',
  'permission-audit/crypto',
  'permission-audit/database',
];

describe('getSuggestion()', () => {
  for (const ruleId of KNOWN_RULE_IDS) {
    it(`has suggestion for known rule: ${ruleId}`, () => {
      const suggestion = getSuggestion(ruleId);
      assert.ok(suggestion, `Missing suggestion for ${ruleId}`);
      assert.ok(suggestion.en, `Missing English suggestion for ${ruleId}`);
      assert.ok(suggestion.zh, `Missing Chinese suggestion for ${ruleId}`);
      assert.ok(suggestion.en.length > 5, `English suggestion too short for ${ruleId}`);
      assert.ok(suggestion.zh.length > 2, `Chinese suggestion too short for ${ruleId}`);
    });
  }

  it('unknown rule id returns generic fallback', () => {
    const suggestion = getSuggestion('totally-unknown/rule-xyz');
    assert.ok(suggestion, 'Should return fallback');
    assert.ok(suggestion.en, 'Fallback should have English');
    assert.ok(suggestion.zh, 'Fallback should have Chinese');
  });

  it('fallback has both en and zh', () => {
    const suggestion = getSuggestion('nonexistent/rule');
    assert.equal(typeof suggestion.en, 'string');
    assert.equal(typeof suggestion.zh, 'string');
    assert.ok(suggestion.en.length > 0);
    assert.ok(suggestion.zh.length > 0);
  });

  it('known suggestions are different from fallback', () => {
    const fallback = getSuggestion('nonexistent/rule');
    for (const ruleId of KNOWN_RULE_IDS) {
      const suggestion = getSuggestion(ruleId);
      assert.notEqual(suggestion.en, fallback.en, `${ruleId} should not use fallback English`);
      assert.notEqual(suggestion.zh, fallback.zh, `${ruleId} should not use fallback Chinese`);
    }
  });
});
