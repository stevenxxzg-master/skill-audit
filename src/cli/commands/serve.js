/**
 * @file cli/commands/serve.js
 * @description Serve subcommand — start the API server
 * @license MIT
 */

import { createServer } from '../../server.js'
import { COLORS } from '../../utils.js'
import { getArg } from '../parser.js'

export async function runServe() {
  const portStr = getArg('--port', '-p')
  const port = portStr ? parseInt(portStr, 10) : 3847
  const server = createServer()
  server.listen(port, () => {
    console.log(`${COLORS.green}✓ skill-audit API server listening on http://localhost:${port}${COLORS.reset}`)
    console.log('  POST /api/scan        Upload zip/tar.gz')
    console.log('  POST /api/scan-url    Clone & scan git URL')
    console.log('  GET  /api/badge       SVG badge')
    console.log('  GET  /api/health      Health check')
  })
}
