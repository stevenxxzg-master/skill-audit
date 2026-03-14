/**
 * Standalone server entry point (used by Docker / direct start)
 */
import { createServer } from './server.js';

const port = parseInt(process.env.PORT, 10) || 3847;
const server = createServer();
server.listen(port, '0.0.0.0', () => {
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'start',
    port,
  }) + '\n');
});
