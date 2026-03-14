import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, parseManifest } from '../src/parsers/index.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, writeFile, rm } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, 'fixtures');
const tmpDir = join(__dirname, 'fixtures', '_parser-tmp');

// Helper: create a temp fixture dir with files
async function makeTmpFixture(name, files) {
  const dir = join(tmpDir, name);
  await mkdir(dir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(join(dir, filename), content);
  }
  return dir;
}

// Cleanup after all tests
async function cleanup() {
  try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
}

// ─── detectFormat ───

describe('detectFormat()', () => {
  it('detects openclaw format (has SKILL.md)', async () => {
    const format = await detectFormat(join(fixtures, 'clean-skill'));
    assert.equal(format, 'openclaw');
  });

  it('detects langchain format', async () => {
    const dir = await makeTmpFixture('langchain-tool', {
      'tool.py': `
from langchain.tools import BaseTool

class MyTool(BaseTool):
    name = "my_tool"
    description = "A test tool"
`,
    });
    const format = await detectFormat(dir);
    assert.equal(format, 'langchain');
    await cleanup();
  });

  it('detects crewai format', async () => {
    const dir = await makeTmpFixture('crewai-tool', {
      'tool.py': `
from crewai_tools import BaseTool

class SearchTool(BaseTool):
    name = "search"
    description = "Search the web"
`,
    });
    const format = await detectFormat(dir);
    assert.equal(format, 'crewai');
    await cleanup();
  });

  it('returns unknown for unrecognized format', async () => {
    const dir = await makeTmpFixture('unknown-tool', {
      'readme.txt': 'just a readme',
    });
    const format = await detectFormat(dir);
    assert.equal(format, 'unknown');
    await cleanup();
  });
});

// ─── parseManifest — OpenClaw ───

describe('parseManifest() — OpenClaw', () => {
  it('parses SKILL.md name and description', async () => {
    const manifest = await parseManifest(join(fixtures, 'clean-skill'));
    assert.equal(manifest.format, 'openclaw');
    assert.equal(manifest.name, 'Clean Skill');
    assert.ok(manifest.description.length > 0);
  });

  it('extracts declared permissions from SKILL.md sections', async () => {
    const dir = await makeTmpFixture('oc-perms', {
      'SKILL.md': `# My Skill

A skill that does things.

## Permissions

- filesystem
- network
- exec

## Usage

Use it wisely.
`,
    });
    const manifest = await parseManifest(dir);
    assert.equal(manifest.format, 'openclaw');
    assert.equal(manifest.name, 'My Skill');
    assert.deepEqual(manifest.declaredPermissions, ['filesystem', 'network', 'exec']);
    await cleanup();
  });

  it('merges permissions from package.json', async () => {
    const dir = await makeTmpFixture('oc-pkg-perms', {
      'SKILL.md': `# Pkg Skill

A skill.

## Permissions

- filesystem
`,
      'package.json': JSON.stringify({
        name: 'pkg-skill',
        permissions: ['network', 'filesystem'],
      }),
    });
    const manifest = await parseManifest(dir);
    assert.ok(manifest.declaredPermissions.includes('filesystem'));
    assert.ok(manifest.declaredPermissions.includes('network'));
    // No duplicates
    assert.equal(manifest.declaredPermissions.filter(p => p === 'filesystem').length, 1);
    await cleanup();
  });

  it('returns null for unknown format', async () => {
    const dir = await makeTmpFixture('no-format', {
      'data.csv': 'a,b,c',
    });
    const manifest = await parseManifest(dir);
    assert.equal(manifest, null);
    await cleanup();
  });

  it('includes file list', async () => {
    const manifest = await parseManifest(join(fixtures, 'clean-skill'));
    assert.ok(Array.isArray(manifest.files));
    assert.ok(manifest.files.includes('SKILL.md'));
  });
});

// ─── parseManifest — LangChain ───

describe('parseManifest() — LangChain', () => {
  it('parses BaseTool subclass', async () => {
    const dir = await makeTmpFixture('lc-basetool', {
      'tool.py': `
from langchain.tools import BaseTool

class WebSearch(BaseTool):
    name = "web_search"
    description = "Search the web for information"
    permissions = ["network"]
`,
    });
    const manifest = await parseManifest(dir);
    assert.equal(manifest.format, 'langchain');
    assert.equal(manifest.name, 'web_search');
    assert.equal(manifest.description, 'Search the web for information');
    assert.ok(manifest.declaredPermissions.includes('network'));
    await cleanup();
  });

  it('parses JS StructuredTool', async () => {
    const dir = await makeTmpFixture('lc-js-tool', {
      'tool.js': `
import { StructuredTool } from 'langchain/tools';

class FileTool extends StructuredTool {
  name = "file_tool";
  description = "Read and write files";
  permissions = ["filesystem"];
}
`,
    });
    const manifest = await parseManifest(dir);
    assert.equal(manifest.format, 'langchain');
    assert.equal(manifest.name, 'file_tool');
    assert.ok(manifest.declaredPermissions.includes('filesystem'));
    await cleanup();
  });
});

// ─── parseManifest — CrewAI ───

describe('parseManifest() — CrewAI', () => {
  it('parses @tool decorator', async () => {
    const dir = await makeTmpFixture('crew-decorator', {
      'tools.py': `
from crewai_tools import tool

@tool
def search_web(query: str) -> str:
    """Search the web"""
    pass
`,
    });
    const manifest = await parseManifest(dir);
    assert.equal(manifest.format, 'crewai');
    assert.equal(manifest.name, 'search_web');
    await cleanup();
  });

  it('parses BaseTool subclass with permissions', async () => {
    const dir = await makeTmpFixture('crew-basetool', {
      'tool.py': `
from crewai import BaseTool

class DBTool(BaseTool):
    name = "db_tool"
    description = "Query the database"
    required_permissions = ["database", "network"]
`,
    });
    const manifest = await parseManifest(dir);
    assert.equal(manifest.format, 'crewai');
    assert.equal(manifest.name, 'db_tool');
    assert.ok(manifest.declaredPermissions.includes('database'));
    assert.ok(manifest.declaredPermissions.includes('network'));
    await cleanup();
  });
});

// ─── permission-audit manifest comparison ───

describe('permission-audit manifest comparison', () => {
  it('flags undeclared permissions as danger', async () => {
    const dir = await makeTmpFixture('undeclared-perms', {
      'SKILL.md': `# Test Skill

A test.

## Permissions

- filesystem
`,
      'index.js': `
import { readFile } from 'fs/promises';
const res = await fetch('https://api.example.com/data');
exec('ls -la');
`,
    });
    const { audit } = await import('../src/index.js');
    const report = await audit(dir);

    // Should have manifest
    assert.ok(report.manifest);
    assert.equal(report.manifest.format, 'openclaw');

    // Should flag undeclared network and exec as danger
    const undeclaredNetwork = report.findings.find(f => f.rule === 'permission-audit/undeclared-network');
    assert.ok(undeclaredNetwork, 'should flag undeclared network');
    assert.equal(undeclaredNetwork.severity, 'danger');

    const undeclaredExec = report.findings.find(f => f.rule === 'permission-audit/undeclared-exec');
    assert.ok(undeclaredExec, 'should flag undeclared exec');
    assert.equal(undeclaredExec.severity, 'danger');

    await cleanup();
  });

  it('flags over-declared permissions as warn', async () => {
    const dir = await makeTmpFixture('over-declared', {
      'SKILL.md': `# Over Skill

A test.

## Permissions

- filesystem
- network
- database
- crypto
`,
      'index.js': `
import { readFile } from 'fs/promises';
const data = await readFile('config.json');
`,
    });
    const { audit } = await import('../src/index.js');
    const report = await audit(dir);

    // Should flag unused network, database, crypto as warn
    const unusedNetwork = report.findings.find(f => f.rule === 'permission-audit/unused-network');
    assert.ok(unusedNetwork, 'should flag unused network');
    assert.equal(unusedNetwork.severity, 'warn');

    const unusedDb = report.findings.find(f => f.rule === 'permission-audit/unused-database');
    assert.ok(unusedDb, 'should flag unused database');

    await cleanup();
  });

  it('no manifest findings when no manifest available', async () => {
    const dir = await makeTmpFixture('no-manifest', {
      'app.py': `
print("hello")
`,
    });
    const { audit } = await import('../src/index.js');
    const report = await audit(dir);

    // No manifest-related findings
    const manifestFindings = report.findings.filter(f => f.file === 'manifest');
    assert.equal(manifestFindings.length, 0);
    assert.equal(report.manifest, undefined);

    await cleanup();
  });
});
