// Example: Async rule plugin for skill-audit
// Demonstrates an async scan function that could call external APIs
//
// This example checks if URLs found in code are on a blocklist.
// In production, you might call a real threat intelligence API.
//
// Usage: skill-audit ./my-skill --plugins ./examples

const URL_PATTERN = /https?:\/\/[^\s"'`<>)\]]+/g;

// Simulated blocklist (in production, fetch from an API)
const BLOCKLIST = new Set([
  'http://evil.example.com',
  'https://malware.example.com',
  'https://phishing.example.com',
]);

/**
 * Simulate an async API call to check a URL against a threat database.
 * Replace this with a real API call in production (e.g., VirusTotal, URLhaus).
 */
async function checkUrl(url) {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1));

  const normalized = url.replace(/\/+$/, '').toLowerCase();
  return BLOCKLIST.has(normalized);
}

export default {
  id: 'url-blocklist',
  name: 'URL Blocklist Check',

  // scan() can be async — skill-audit handles Promise results
  async scan(content, file) {
    const findings = [];
    const lines = content.split('\n');

    // Collect all URLs first
    const urlsToCheck = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      URL_PATTERN.lastIndex = 0;
      let match;
      while ((match = URL_PATTERN.exec(line)) !== null) {
        urlsToCheck.push({ url: match[0], line: i + 1, lineText: line });
      }
    }

    // Check all URLs concurrently
    const results = await Promise.all(
      urlsToCheck.map(async ({ url, line, lineText }) => {
        const blocked = await checkUrl(url);
        return { url, line, lineText, blocked };
      })
    );

    for (const { url, line, lineText, blocked } of results) {
      if (blocked) {
        findings.push({
          rule: 'url-blocklist/blocked',
          severity: 'danger',
          file: file.rel,
          line,
          msg: `Blocked URL detected: ${url}`,
          snippet: lineText.trim().slice(0, 120),
          fix: 'This URL is on a known threat blocklist. Remove it or verify it is safe.',
        });
      }
    }

    return findings;
  },
};
