const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions/gi, id: 'ignore-prev', msg: 'Prompt injection: "ignore previous instructions"', severity: 'danger' },
  { pattern: /you\s+are\s+now\s+(?:a|an|the)\s+/gi, id: 'role-override', msg: 'Prompt injection: role override attempt', severity: 'danger' },
  { pattern: /disregard\s+(?:all\s+)?(?:previous|prior|above)/gi, id: 'disregard', msg: 'Prompt injection: disregard instructions', severity: 'danger' },
  { pattern: /forget\s+(?:all\s+)?(?:previous|prior|your)\s+(?:instructions|rules|guidelines)/gi, id: 'forget', msg: 'Prompt injection: forget instructions', severity: 'danger' },
  { pattern: /(?:system|admin)\s*:\s*(?:override|execute|run|grant)/gi, id: 'fake-system', msg: 'Prompt injection: fake system command', severity: 'danger' },
  { pattern: /\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b/gi, id: 'jailbreak', msg: 'Jailbreak pattern detected (DAN)', severity: 'danger' },
  { pattern: /do\s+not\s+(?:follow|obey|listen\s+to)\s+(?:your|the|any)\s+(?:rules|guidelines|instructions)/gi, id: 'disobey', msg: 'Prompt injection: instruction to disobey rules', severity: 'danger' },
  { pattern: /pretend\s+(?:you\s+(?:are|have)|that|there\s+(?:are|is))\s+no\s+(?:rules|restrictions|limits|guidelines)/gi, id: 'pretend-no-rules', msg: 'Prompt injection: pretend no rules exist', severity: 'danger' },
  { pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/g, id: 'special-tokens', msg: 'LLM special tokens in content — potential injection vector', severity: 'warn' },
  { pattern: /<<\s*SYS\s*>>|<<\s*\/SYS\s*>>/g, id: 'llama-sys', msg: 'Llama system tokens detected', severity: 'warn' },
  { pattern: /\bact\s+as\s+(?:if\s+you\s+(?:are|were)|a|an|the|my)\b/gi, id: 'act-as', msg: 'Potential role manipulation: "act as"', severity: 'warn' },
];

export const promptInjection = {
  id: 'prompt-injection',
  name: 'Prompt Injection Detection',
  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, id, msg, severity } of INJECTION_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: `prompt-injection/${id}`,
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
