#!/usr/bin/env node
/**
 * @file cli.js
 * @description Thin CLI entry point — routes to subcommands
 * @license MIT
 */

import { positional } from '../src/cli/parser.js'
import { runScan } from '../src/cli/commands/scan.js'
import { runServe } from '../src/cli/commands/serve.js'
import { runBadge } from '../src/cli/commands/badge.js'
import { runHistory } from '../src/cli/commands/history.js'
import { runDiff } from '../src/cli/commands/diff.js'

const subcommand = positional[0]

const commands = {
  history: runHistory,
  diff: runDiff,
  serve: runServe,
  badge: runBadge,
}

const handler = commands[subcommand]
if (handler) {
  handler()
} else {
  runScan(subcommand)
}
