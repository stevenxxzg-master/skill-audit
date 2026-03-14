// Parser for OpenClaw skill format
// Reads SKILL.md and package.json/manifest to extract skill metadata

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Extract name and description from SKILL.md
 * Expects: # Title as name, first paragraph as description
 * Looks for ## Permissions / ## Capabilities sections for declared permissions
 */
function parseSkillMd(content) {
  const lines = content.split('\n');
  let name = '';
  let description = '';
  const declaredPermissions = [];

  // Extract name from first H1
  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      name = line.replace(/^#\s+/, '').trim();
      break;
    }
  }

  // Extract description: first non-empty, non-heading line after the title
  let pastTitle = false;
  for (const line of lines) {
    if (/^#\s+/.test(line)) { pastTitle = true; continue; }
    if (pastTitle && line.trim() && !line.startsWith('#')) {
      description = line.trim();
      break;
    }
  }

  // Extract declared permissions from ## Permissions or ## Capabilities sections
  let inPermSection = false;
  for (const line of lines) {
    if (/^##\s+(Permissions|Capabilities|Tools|Access)/i.test(line)) {
      inPermSection = true;
      continue;
    }
    if (/^##\s+/.test(line) && inPermSection) {
      inPermSection = false;
      continue;
    }
    if (inPermSection) {
      // Match list items like "- filesystem", "- network: ..."
      const m = line.match(/^[-*]\s+(\w+)/);
      if (m) declaredPermissions.push(m[1].toLowerCase());
    }
  }

  return { name, description, declaredPermissions };
}

/**
 * Extract permissions/capabilities from package.json
 */
function parsePackageJson(content) {
  try {
    const pkg = JSON.parse(content);
    const perms = [];
    // Check skill.permissions, permissions, capabilities fields
    const permField = pkg.skill?.permissions || pkg.permissions || pkg.capabilities || [];
    if (Array.isArray(permField)) {
      perms.push(...permField.map(p => String(p).toLowerCase()));
    }
    return { name: pkg.name || '', perms };
  } catch {
    return { name: '', perms: [] };
  }
}

/**
 * Detect if a directory is an OpenClaw skill
 */
export async function detect(dir) {
  try {
    const entries = await readdir(dir);
    return entries.includes('SKILL.md');
  } catch {
    return false;
  }
}

/**
 * Parse an OpenClaw skill directory into a unified manifest
 */
export async function parse(dir) {
  const entries = await readdir(dir);
  const files = entries.filter(e => !e.startsWith('.') && e !== 'node_modules');

  let name = '';
  let description = '';
  let declaredPermissions = [];

  // Parse SKILL.md
  if (entries.includes('SKILL.md')) {
    const content = await readFile(join(dir, 'SKILL.md'), 'utf-8');
    const md = parseSkillMd(content);
    name = md.name;
    description = md.description;
    declaredPermissions = md.declaredPermissions;
  }

  // Parse package.json for additional permissions
  if (entries.includes('package.json')) {
    const content = await readFile(join(dir, 'package.json'), 'utf-8');
    const pkg = parsePackageJson(content);
    if (!name && pkg.name) name = pkg.name;
    if (pkg.perms.length > 0) {
      // Merge, deduplicate
      for (const p of pkg.perms) {
        if (!declaredPermissions.includes(p)) declaredPermissions.push(p);
      }
    }
  }

  // Also check manifest.json / manifest.yaml
  if (entries.includes('manifest.json')) {
    try {
      const content = await readFile(join(dir, 'manifest.json'), 'utf-8');
      const manifest = JSON.parse(content);
      const perms = manifest.permissions || manifest.capabilities || [];
      if (Array.isArray(perms)) {
        for (const p of perms) {
          const lp = String(p).toLowerCase();
          if (!declaredPermissions.includes(lp)) declaredPermissions.push(lp);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  return {
    format: 'openclaw',
    name,
    description,
    declaredPermissions,
    files,
  };
}
