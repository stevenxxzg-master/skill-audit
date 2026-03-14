const NETWORK_PATTERNS = [
  { pattern: /curl\s+.*\|\s*(?:bash|sh|zsh)/g, id: 'curl-pipe-shell', msg: 'curl piped to shell — remote code execution', severity: 'danger' },
  { pattern: /wget\s+.*\|\s*(?:bash|sh|zsh)/g, id: 'wget-pipe-shell', msg: 'wget piped to shell — remote code execution', severity: 'danger' },
  { pattern: /curl\s+(?:-[a-zA-Z]*\s+)*(?:--data|--data-raw|-d)\s/g, id: 'curl-post', msg: 'curl POST request — potential data exfiltration', severity: 'warn' },
  { pattern: /fetch\s*\(\s*['"`][^'"`]*['"`]\s*,\s*\{[^}]*method\s*:\s*['"]POST['"]/gi, id: 'fetch-post', msg: 'fetch POST — potential data exfiltration', severity: 'warn' },
  { pattern: /requests\.post\s*\(/g, id: 'requests-post', msg: 'Python requests.post — potential data exfiltration', severity: 'warn' },
  { pattern: /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/g, id: 'raw-ip', msg: 'HTTP request to raw IP address', severity: 'warn' },
  { pattern: /(?:ngrok|localtunnel|serveo|bore\.pub)/gi, id: 'tunnel', msg: 'Tunnel service detected — potential data exfiltration channel', severity: 'danger' },
  { pattern: /(?:pastebin|hastebin|0x0\.st|transfer\.sh|file\.io)/gi, id: 'paste-service', msg: 'Paste/file sharing service — potential data exfiltration', severity: 'warn' },
  { pattern: /webhook\.site|requestbin|hookbin/gi, id: 'webhook-test', msg: 'Webhook testing service — potential data capture', severity: 'warn' },
  { pattern: /dns\.(?:google|quad9|cloudflare)|1\.1\.1\.1|8\.8\.8\.8/g, id: 'dns-override', msg: 'DNS resolver override', severity: 'warn' },
];

export const suspiciousNetwork = {
  id: 'suspicious-network',
  name: 'Suspicious Network Activity',
  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, id, msg, severity } of NETWORK_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: `suspicious-network/${id}`,
            severity,
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }
    return findings;
  },
};
