/**
 * @file parsers/index.js
 * @description Auto-detect skill format and parse manifest
 * @license MIT
 */

import * as openclaw from './openclaw.js';
import * as langchain from './langchain.js';
import * as crewai from './crewai.js';

const parsers = [
  { format: 'openclaw', module: openclaw },
  { format: 'crewai', module: crewai },
  { format: 'langchain', module: langchain },
];

/**
 * Detect the skill format of a directory
 * @param {string} dir - Path to the skill directory
 * @returns {Promise<'openclaw'|'langchain'|'crewai'|'unknown'>}
 */
export async function detectFormat(dir) {
  for (const { format, module: mod } of parsers) {
    if (await mod.detect(dir)) return format;
  }
  return 'unknown';
}

/**
 * Parse a skill directory into a unified manifest object
 * @param {string} dir - Path to the skill directory
 * @returns {Promise<{format: string, name: string, description: string, declaredPermissions: string[], files: string[]}|null>}
 */
export async function parseManifest(dir) {
  const format = await detectFormat(dir);
  if (format === 'unknown') return null;

  const parser = parsers.find(p => p.format === format);
  return parser.module.parse(dir);
}
