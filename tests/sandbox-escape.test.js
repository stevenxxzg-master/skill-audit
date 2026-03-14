import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sandboxEscape } from '../src/rules/sandbox-escape.js';

function scan(content, filename = 'test.sh') {
  return sandboxEscape.scan(content, { rel: filename, ext: '.sh' }, {});
}

describe('sandbox-escape rule', () => {
  it('has correct id', () => {
    assert.equal(sandboxEscape.id, 'sandbox-escape');
  });

  // ─── Container escape ───

  describe('container escape', () => {
    it('detects mount /proc', () => {
      const hits = scan('mount -t proc /proc /mnt/proc');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/mount-proc'));
      assert.ok(hits.some(h => h.severity === 'danger'));
    });

    it('detects mount /sys', () => {
      const hits = scan('mount -t sysfs /sys /mnt/sys');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/mount-sys'));
    });

    it('detects --privileged flag', () => {
      const hits = scan('docker run --privileged alpine');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/privileged'));
    });

    it('detects docker.sock access', () => {
      const hits = scan('docker run -v /var/run/docker.sock:/var/run/docker.sock alpine');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/docker-sock'));
    });
  });

  // ─── Capability escalation ───

  describe('capability escalation', () => {
    it('detects CAP_SYS_ADMIN', () => {
      const hits = scan('docker run --cap-add CAP_SYS_ADMIN alpine');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/cap-sys-admin'));
      assert.ok(hits.some(h => h.severity === 'danger'));
    });

    it('detects --cap-add', () => {
      const hits = scan('docker run --cap-add NET_ADMIN alpine');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/cap-add'));
    });

    it('detects setuid', () => {
      const hits = scan('chmod u+s /bin/bash  # setuid');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/setuid'));
    });

    it('detects setgid', () => {
      const hits = scan('chmod g+s /bin/bash  # setgid');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/setgid'));
    });
  });

  // ─── Namespace manipulation ───

  describe('namespace manipulation', () => {
    it('detects unshare', () => {
      const hits = scan('unshare -m /bin/bash');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/unshare'));
    });

    it('detects nsenter', () => {
      const hits = scan('nsenter -t 1 -m -u -i -n -p');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/nsenter'));
      assert.ok(hits.some(h => h.severity === 'danger'));
    });

    it('detects chroot', () => {
      const hits = scan('chroot /mnt/host /bin/bash');
      assert.ok(hits.length > 0);
      assert.ok(hits.some(h => h.rule === 'sandbox-escape/chroot'));
    });
  });

  // ─── No false positives ───

  describe('no false positives', () => {
    it('clean script passes', () => {
      const content = `#!/bin/bash
echo "Hello world"
ls -la
cat /etc/hostname
`;
      const hits = scan(content);
      assert.equal(hits.length, 0);
    });

    it('normal JavaScript passes', () => {
      const content = `import { readFile } from 'fs/promises';
export async function load(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}`;
      const hits = scan(content, 'index.js');
      assert.equal(hits.length, 0);
    });
  });
});
