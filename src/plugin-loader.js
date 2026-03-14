import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';

function isValidRule(rule) {
  return (
    rule &&
    typeof rule.id === 'string' &&
    typeof rule.name === 'string' &&
    typeof rule.scan === 'function'
  );
}

export async function loadPlugins(pluginDir) {
  if (!pluginDir) return [];

  let entries;
  try {
    entries = await readdir(pluginDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`⚠ Plugin directory not found: ${pluginDir}`);
      return [];
    }
    throw err;
  }

  const plugins = [];

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== '.js') continue;

    const filePath = join(pluginDir, entry.name);
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const rule = mod.default || mod;

      if (isValidRule(rule)) {
        plugins.push(rule);
      } else {
        console.warn(`⚠ Skipping invalid plugin (missing id/name/scan): ${entry.name}`);
      }
    } catch (err) {
      console.warn(`⚠ Failed to load plugin ${entry.name}: ${err.message}`);
    }
  }

  return plugins;
}
