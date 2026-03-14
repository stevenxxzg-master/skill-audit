// Example: Custom regex-based rule plugin for skill-audit
// Detects hardcoded URLs pointing to known paste/sharing services
//
// Usage: skill-audit ./my-skill --plugins ./examples

const SUSPICIOUS_DOMAINS = [
  /https?:\/\/pastebin\.com\/\w+/gi,
  /https?:\/\/hastebin\.com\/\w+/gi,
  /https?:\/\/ghostbin\.\w+\/\w+/gi,
  /https?:\/\/paste\.ee\/\w+/gi,
  /https?:\/\/dpaste\.org\/\w+/gi,
  /https?:\/\/rentry\.co\/\w+/gi,
];

export default {
  id: 'suspicious-paste-url',
  name: 'Suspicious Paste Service URL',
  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SUSPICIOUS_DOMAINS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          findings.push({
            rule: 'suspicious-paste-url/detected',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `URL to paste service detected: ${match[0]}`,
            snippet: line.trim().slice(0, 120),
            fix: 'Paste service URLs may contain exfiltrated data or malicious payloads. Verify the content.',
          });
        }
      }
    }

    return findings;
  },
};
