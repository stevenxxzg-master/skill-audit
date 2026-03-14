/**
 * @file server-start.js
 * @description Standalone server entry point (Docker / direct start)
 * @license MIT
 */
import { createServer } from './server.js';

// skill-audit-ignore-next-line
const port = parseInt(process.env.PORT, 10) || 3847;
const server = createServer();
server.listen(port, '0.0.0.0', () => {
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'start',
    port,
  }) + '\n');
});
