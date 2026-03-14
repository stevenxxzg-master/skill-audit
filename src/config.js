/**
 * @file config.js
 * @description Configuration file loader for .skill-audit.json
 * @license MIT
 */

// skill-audit-ignore-next-line
import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

const DEFAULT_CONFIG = {
  rules: {},       // { 'rule-id': true/false }
  severity: {},    // { 'rule-id': 'warn'|'danger' }
  ignore: [],      // glob-like patterns to skip
  plugins: null,   // plugin directory path
};

/**
 * Load skill-audit configuration from file or defaults.
 *
 * Resolution order:
 * 1. Explicit configPath (if provided)
 * 2. .skillauditrc.json in targetDir
 * 3. skill-audit.config.js in targetDir
 * 4. Default config (all rules enabled, no ignores, no plugins)
 *
 * @param {string} targetDir - The skill directory being scanned
 * @param {string} [configPath] - Optional explicit path to a config file (.json or .js)
 * @returns {Promise<{rules: Record<string, boolean>, severity: Record<string, string>, ignore: string[], plugins: string|null}>}
 */
export async function loadConfig(targetDir, configPath) {
  let userConfig = {};

  if (configPath) {
    userConfig = await loadConfigFile(configPath);
  } else {
    // Try .skillauditrc.json first, then skill-audit.config.js
    const jsonPath = join(targetDir, '.skillauditrc.json');
    const jsPath = join(targetDir, 'skill-audit.config.js');

    try {
      const raw = await readFile(jsonPath, 'utf-8');
      userConfig = JSON.parse(raw);
    } catch {
      try {
        const mod = await import(pathToFileURL(jsPath).href);
        userConfig = mod.default || mod;
      } catch {
        // No config file found — use defaults
      }
    }
  }

  return { ...DEFAULT_CONFIG, ...userConfig };
}

async function loadConfigFile(configPath) {
  if (configPath.endsWith('.json')) {
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  }
  const mod = await import(pathToFileURL(configPath).href);
  return mod.default || mod;
}
