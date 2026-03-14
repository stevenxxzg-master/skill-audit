/**
 * @file parsers/langchain.js
 * @description Parser for LangChain tool format (BaseTool, tool definitions)
 * @license MIT
 */

// skill-audit-ignore-next-line
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';

const TOOL_PATTERNS = {
  // Python BaseTool subclass
  baseTool: /class\s+(\w+)\s*\(\s*BaseTool\s*\)/,
  // name = "..." in class body
  nameField: /name\s*[:=]\s*["']([^"']+)["']/,
  // description = "..." in class body
  descField: /description\s*[:=]\s*["']([^"']+)["']/,
  // args_schema
  argsSchema: /args_schema\s*[:=]\s*(\w+)/,
  // @tool decorator
  toolDecorator: /@tool(?:\s*\()?/,
  // permissions or required_permissions field
  permissions: /(?:permissions|required_permissions|capabilities)\s*[:=]\s*\[([^\]]*)\]/,
};

/**
 * Parse a single Python file for LangChain tool definitions
 */
function parsePythonFile(content) {
  const tools = [];
  const declaredPermissions = [];

  // Check for BaseTool subclass
  const classMatch = content.match(TOOL_PATTERNS.baseTool);
  if (classMatch) {
    const tool = { className: classMatch[1] };
    const nameMatch = content.match(TOOL_PATTERNS.nameField);
    if (nameMatch) tool.name = nameMatch[1];
    const descMatch = content.match(TOOL_PATTERNS.descField);
    if (descMatch) tool.description = descMatch[1];
    const argsMatch = content.match(TOOL_PATTERNS.argsSchema);
    if (argsMatch) tool.argsSchema = argsMatch[1];
    tools.push(tool);
  }

  // Check for @tool decorator
  if (TOOL_PATTERNS.toolDecorator.test(content)) {
    // Find function name after decorator
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (TOOL_PATTERNS.toolDecorator.test(lines[i])) {
        // Next non-empty line should be def
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
  const permMatch = content.match(TOOL_PATTERNS.permissions);
  if (permMatch) {
    const perms = permMatch[1].match(/["']([^"']+)["']/g);
    if (perms) {
      declaredPermissions.push(...perms.map(p => p.replace(/["']/g, '').toLowerCase()));
    }
  }

  return { tools, declaredPermissions };
}

/**
 * Parse a JS/TS file for LangChain tool definitions
 */
function parseJsFile(content) {
  const tools = [];
  const declaredPermissions = [];

  // Check for extends BaseTool or extends Tool
  const classMatch = content.match(/class\s+(\w+)\s+extends\s+(?:BaseTool|Tool|StructuredTool)\b/);
  if (classMatch) {
    const tool = { className: classMatch[1] };
    const nameMatch = content.match(TOOL_PATTERNS.nameField);
    if (nameMatch) tool.name = nameMatch[1];
    const descMatch = content.match(TOOL_PATTERNS.descField);
    if (descMatch) tool.description = descMatch[1];
    tools.push(tool);
  }

  // Extract permissions
  const permMatch = content.match(TOOL_PATTERNS.permissions);
  if (permMatch) {
    const perms = permMatch[1].match(/["']([^"']+)["']/g);
    if (perms) {
      declaredPermissions.push(...perms.map(p => p.replace(/["']/g, '').toLowerCase()));
    }
  }

  return { tools, declaredPermissions };
}

/**
 * Detect if a directory contains LangChain tools
 */
export async function detect(dir) {
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const ext = extname(entry).toLowerCase();
      if (['.py', '.js', '.ts'].includes(ext)) {
        const content = await readFile(join(dir, entry), 'utf-8');
        if (/BaseTool|StructuredTool|from\s+langchain/.test(content)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Parse a LangChain tool directory into a unified manifest
 */
export async function parse(dir) {
  const entries = await readdir(dir);
  const files = entries.filter(e => !e.startsWith('.') && e !== 'node_modules');
  const allTools = [];
  const allPermissions = [];

  for (const entry of files) {
    const ext = extname(entry).toLowerCase();
    if (!['.py', '.js', '.ts'].includes(ext)) continue;

    const content = await readFile(join(dir, entry), 'utf-8');
    const parsed = ext === '.py' ? parsePythonFile(content) : parseJsFile(content);
    allTools.push(...parsed.tools);
    for (const p of parsed.declaredPermissions) {
      if (!allPermissions.includes(p)) allPermissions.push(p);
    }
  }

  const name = allTools[0]?.name || allTools[0]?.className || '';
  const description = allTools[0]?.description || '';

  return {
    format: 'langchain',
    name,
    description,
    declaredPermissions: allPermissions,
    files,
  };
}
