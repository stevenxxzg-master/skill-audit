/**
 * @file cli/parser.js
 * @description CLI argument parsing — flags, named args, positional extraction
 * @license MIT
 */

const args = process.argv.slice(2)

export const flags = new Set(args.filter(a => a.startsWith('--') || (a.startsWith('-') && a.length === 2)))
export const positional = args.filter(a => !a.startsWith('-'))

/**
 * Get a named argument value by long/short flag
 * @param {string} long - Long flag name (e.g. '--output')
 * @param {string|null} short - Short flag name (e.g. '-o')
 * @returns {string|null}
 */
export function getArg(long, short) {
  let idx = args.indexOf(long)
  if (idx === -1 && short) idx = args.indexOf(short)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return null
}
