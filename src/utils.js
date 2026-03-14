/**
 * Public utility functions for skill-audit
 * Shared across index.js, server.js, and rules
 */

import { lstat } from 'fs/promises';

/**
 * Check if a hostname/IP is a private/internal address
 * Covers: 10.x, 172.16-31.x, 192.168.x, 127.x, 0.0.0.0, ::1, localhost
 */
export function isPrivateIp(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;

  const h = hostname.toLowerCase().trim();

  // Localhost variants
  if (h === 'localhost' || h === '::1') return true;

  // IPv4 patterns
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [, a, b] = ipv4Match.map(Number);

  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 127) return true;                          // 127.0.0.0/8
  if (a === 0) return true;                            // 0.0.0.0

  return false;
}

// Characters that could enable command injection in shell contexts
const DANGEROUS_URL_CHARS = /[;|&`$(){}!<>]/;

/**
 * Validate and sanitize a URL for safe use in git clone / fetch
 * Throws on invalid or dangerous URLs
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }

  const trimmed = url.trim();

  // Block file:// protocol
  if (/^file:/i.test(trimmed)) {
    throw new Error('file:// URLs are not allowed');
  }

  // Must be http or https
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('URL must start with http:// or https://');
  }

  // Block command injection characters
  if (DANGEROUS_URL_CHARS.test(trimmed)) {
    throw new Error('URL contains dangerous characters');
  }

  // Parse and check for private IPs
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (isPrivateIp(parsed.hostname)) {
    throw new Error('URLs pointing to private/internal IPs are not allowed');
  }

  return trimmed;
}

/**
 * Check if a path is a symlink that creates a loop
 * @param {string} filePath - Path to check
 * @param {Set<string>} visitedInodes - Set of "dev:ino" strings already visited
 * @returns {Promise<{isLoop: boolean, inodeKey: string|null}>}
 */
export async function isSymlinkLoop(filePath, visitedInodes) {
  try {
    const stats = await lstat(filePath);
    if (!stats.isSymbolicLink() && !stats.isDirectory()) {
      return { isLoop: false, inodeKey: null };
    }
    const inodeKey = `${stats.dev}:${stats.ino}`;
    if (visitedInodes.has(inodeKey)) {
      return { isLoop: true, inodeKey };
    }
    return { isLoop: false, inodeKey };
  } catch {
    return { isLoop: false, inodeKey: null };
  }
}

/**
 * Check if a file path contains path traversal sequences
 */
export function hasPathTraversal(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  // Normalize and check for .. components
  const segments = filePath.split(/[/\\]/);
  return segments.some(s => s === '..');
}
