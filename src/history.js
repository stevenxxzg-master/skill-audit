import { mkdir, writeFile, readdir, readFile } from 'fs/promises';
import { join } from 'path';

const HISTORY_DIR = '.skill-audit';

function historyPath(targetDir) {
  return join(targetDir, HISTORY_DIR);
}

/**
 * Save a scan report to the .skill-audit history directory inside the scanned skill.
 * Creates the directory if it doesn't exist. File format: scan-{timestamp}.json.
 *
 * @param {string} targetDir - The scanned skill directory
 * @param {Object} report - The scan report object to save
 * @returns {Promise<{path: string, timestamp: number}>} Saved file path and timestamp
 */
export async function saveReport(targetDir, report) {
  const dir = historyPath(targetDir);
  await mkdir(dir, { recursive: true });
  const ts = Date.now();
  const filename = `scan-${ts}.json`;
  const filePath = join(dir, filename);
  const data = { ...report, timestamp: ts };
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { path: filePath, timestamp: ts };
}

/**
 * Load scan history for a skill directory, sorted newest first.
 *
 * @param {string} targetDir - The scanned skill directory
 * @param {number} [limit] - Max number of reports to return (undefined = all)
 * @returns {Promise<Object[]>} Array of report objects, newest first
 */
export async function loadHistory(targetDir, limit) {
  const dir = historyPath(targetDir);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const scanFiles = entries
    .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
    .sort()
    .reverse(); // newest first

  const selected = limit ? scanFiles.slice(0, limit) : scanFiles;
  const reports = [];
  for (const file of selected) {
    const content = await readFile(join(dir, file), 'utf-8');
    reports.push(JSON.parse(content));
  }
  return reports;
}

/**
 * Get the most recent scan report for a skill directory.
 *
 * @param {string} targetDir - The scanned skill directory
 * @returns {Promise<Object|null>} The latest report, or null if no history exists
 */
export async function getLatest(targetDir) {
  const history = await loadHistory(targetDir, 1);
  return history.length > 0 ? history[0] : null;
}
