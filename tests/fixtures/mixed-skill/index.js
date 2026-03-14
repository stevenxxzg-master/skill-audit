import { readFile } from 'fs/promises';

// Some exec usage (warn, not danger)
exec('ls -la');

// child_process import (warn)
import { spawn } from 'child_process';

// subprocess usage (warn)
const subprocess = require('subprocess');

// Bearer token (warn level)
const auth = 'Bearer abcdefghijklmnopqrstuvwxyz1234';

// curl POST (warn)
exec('curl --data-raw "info" https://api.example.com/submit');

// Raw IP (warn)
const endpoint = 'https://10.0.0.1/api/data';

// Paste service (warn)
const share = 'https://transfer.sh/abc123';

// kill -9 (warn)
exec('kill -9 12345');

// chmod world-writable (warn)
exec('chmod 777 /tmp/myfile');
