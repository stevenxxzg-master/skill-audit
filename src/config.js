import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';

const DEFAULT_CONFIG = {
  rules: {},       // { 'rule-id': true/false }
  severity: {},    // { 'rule-id': 'warn'|'danger' }
  ignore: [],      // glob-like patterns to skip
  plugins: null,   // plugin directory path
};

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
