/**
 * @file parsers/crewai.js
 * @description Parser for CrewAI tool format (@tool decorators, BaseTool)
 * @license MIT
 */

// skill-audit-ignore-next-line
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';

const CREWAI_PATTERNS = {
  // @tool decorator (CrewAI style)
  toolDecorator: /@tool/,
  // CrewAI BaseTool subclass
  baseTool: /class\s+(\w+)\s*\(\s*BaseTool\s*\)/,
  // name field
  nameField: /name\s*[:=]\s*["']([^"']+)["']/,
  // description field
  descField: /description\s*[:=]\s*["']([^"']+)["']/,
  // CrewAI imports
  crewaiImport: /from\s+crewai|import\s+crewai|from\s+crewai_tools/,
  // permissions
  permissions: /(?:permissions|required_permissions|capabilities)\s*[:=]\s*\[([^\]]*)\]/,
};

/**
 * Parse a Python file for CrewAI tool definitions
 */
function parsePythonFile(content) {
  const tools = [];
  const declaredPermissions = [];

  // Check for BaseTool subclass
  const classMatch = content.match(CREWAI_PATTERNS.baseTool);
  if (classMatch) {
    const tool = { className: classMatch[1] };
    const nameMatch = content.match(CREWAI_PATTERNS.nameField);
    if (nameMatch) tool.name = nameMatch[1];
    const descMatch = content.match(CREWAI_PATTERNS.descField);
    if (descMatch) tool.description = descMatch[1];
    tools.push(tool);
  }

  // Check for @tool decorator
  if (CREWAI_PATTERNS.toolDecorator.test(content)) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (CREWAI_PATTERNS.toolDecorator.test(lines[i])) {
        for (let j = i + 1; j < lines.length; j++) {
          const defMatch = lines[j].match(/def\s+(\w+)/);
          if (defMatch) {
            tools.push({ name: defMatch[1], decorator: true });
            break;
          }
          if (lines[j].trim()) break;
        }
      }
    }
  }

  // Extract permissions
  const permMatch = content.match(CREWAI_PATTERNS.permissions);
  if (permMatch) {
    const perms = permMatch[1].match(/["']([^"']+)["']/g);
    if (perms) {
      declaredPermissions.push(...perms.map(p => p.replace(/["']/g, '').toLowerCase()));
    }
  }

  return { tools, declaredPermissions };
}

/**
 * Detect if a directory contains CrewAI tools
 */
export async function detect(dir) {
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (extname(entry).toLowerCase() !== '.py') continue;
      const content = await readFile(join(dir, entry), 'utf-8');
      if (CREWAI_PATTERNS.crewaiImport.test(content)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Parse a CrewAI tool directory into a unified manifest
 */
export async function parse(dir) {
  const entries = await readdir(dir);
  const files = entries.filter(e => !e.startsWith('.') && e !== 'node_modules');
  const allTools = [];
  const allPermissions = [];

  for (const entry of files) {
    if (extname(entry).toLowerCase() !== '.py') continue;
    const content = await readFile(join(dir, entry), 'utf-8');
    const parsed = parsePythonFile(content);
    allTools.push(...parsed.tools);
    for (const p of parsed.declaredPermissions) {
      if (!allPermissions.includes(p)) allPermissions.push(p);
    }
  }

  const name = allTools[0]?.name || allTools[0]?.className || '';
  const description = allTools[0]?.description || '';

  return {
    format: 'crewai',
    name,
    description,
    declaredPermissions: allPermissions,
    files,
  };
}
