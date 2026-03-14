const SUGGESTIONS = {
  // dangerous-commands/*
  'dangerous-commands/rm-force': {
    en: 'Avoid forced recursive deletes. Use trash-cli or add confirmation prompts before deletion.',
    zh: '避免强制递归删除。使用 trash-cli 或在删除前添加确认提示。',
  },
  'dangerous-commands/rm-recursive': {
    en: 'Recursive delete is risky. Prefer trash-cli or validate paths before removal.',
    zh: '递归删除有风险。优先使用 trash-cli 或在删除前验证路径。',
  },
  'dangerous-commands/eval': {
    en: 'Replace eval() with safer alternatives like JSON.parse() or a sandboxed interpreter.',
    zh: '用 JSON.parse() 或沙箱解释器替代 eval()。',
  },
  'dangerous-commands/exec-call': {
    en: 'Use execFile() with explicit args instead of exec() to prevent shell injection.',
    zh: '使用 execFile() 并显式传参，避免 exec() 的 shell 注入风险。',
  },
  'dangerous-commands/child-process': {
    en: 'Ensure child_process calls use fixed commands, not user-controlled input.',
    zh: '确保 child_process 调用使用固定命令，而非用户可控输入。',
  },
  'dangerous-commands/subprocess': {
    en: 'Validate all subprocess arguments. Avoid shell=True with user input.',
    zh: '验证所有 subprocess 参数。避免对用户输入使用 shell=True。',
  },
  'dangerous-commands/os-system': {
    en: 'Replace os.system() with subprocess.run() and explicit argument lists.',
    zh: '用 subprocess.run() 和显式参数列表替代 os.system()。',
  },
  'dangerous-commands/chmod-world': {
    en: 'Avoid world-writable permissions. Use 755 or 644 instead.',
    zh: '避免全局可写权限。使用 755 或 644 替代。',
  },
  'dangerous-commands/kill-9': {
    en: 'Prefer SIGTERM (kill -15) before SIGKILL to allow graceful shutdown.',
    zh: '优先使用 SIGTERM (kill -15) 以允许进程优雅退出。',
  },
  'dangerous-commands/mkfs': {
    en: 'Filesystem format commands are destructive. Add explicit confirmation guards.',
    zh: '格式化文件系统命令具有破坏性。添加明确的确认保护。',
  },
  'dangerous-commands/dd': {
    en: 'dd can overwrite disks. Double-check of= target and add confirmation.',
    zh: 'dd 可覆盖磁盘。仔细检查 of= 目标并添加确认。',
  },
  'dangerous-commands/dev-write': {
    en: 'Direct writes to block devices are extremely dangerous. Add safeguards.',
    zh: '直接写入块设备极其危险。添加安全防护。',
  },
  'dangerous-commands/function-constructor': {
    en: 'Avoid new Function(). Use static code paths or a sandboxed evaluator.',
    zh: '避免 new Function()。使用静态代码路径或沙箱求值器。',
  },
  'dangerous-commands/dunder-import': {
    en: 'Avoid dynamic __import__(). Use explicit static imports.',
    zh: '避免动态 __import__()。使用显式静态导入。',
  },
  'dangerous-commands/importlib': {
    en: 'Validate module names when using importlib to prevent arbitrary code loading.',
    zh: '使用 importlib 时验证模块名，防止加载任意代码。',
  },

  // secret-leaks/*
  'secret-leaks/api-key': {
    en: 'Move API keys to environment variables or a secrets manager.',
    zh: '将 API 密钥移至环境变量或密钥管理器。',
  },
  'secret-leaks/secret': {
    en: 'Never hardcode secrets. Use environment variables or vault services.',
    zh: '不要硬编码密钥。使用环境变量或 vault 服务。',
  },
  'secret-leaks/token': {
    en: 'Move tokens to environment variables. Rotate if already committed.',
    zh: '将 token 移至环境变量。如已提交请立即轮换。',
  },
  'secret-leaks/aws-key': {
    en: 'Use IAM roles or AWS credentials file instead of hardcoded keys. Rotate immediately.',
    zh: '使用 IAM 角色或 AWS 凭证文件替代硬编码密钥。立即轮换。',
  },
  'secret-leaks/openai-key': {
    en: 'Move OpenAI key to env var OPENAI_API_KEY. Rotate if exposed.',
    zh: '将 OpenAI 密钥移至环境变量 OPENAI_API_KEY。如已暴露请轮换。',
  },
  'secret-leaks/github-token': {
    en: 'Revoke and regenerate the GitHub token. Use GITHUB_TOKEN env var.',
    zh: '撤销并重新生成 GitHub token。使用 GITHUB_TOKEN 环境变量。',
  },
  'secret-leaks/gitlab-token': {
    en: 'Revoke the GitLab token and use CI/CD variables instead.',
    zh: '撤销 GitLab token，改用 CI/CD 变量。',
  },
  'secret-leaks/slack-token': {
    en: 'Revoke the Slack token. Use OAuth flow and env vars.',
    zh: '撤销 Slack token。使用 OAuth 流程和环境变量。',
  },
  'secret-leaks/private-key': {
    en: 'Remove private keys from source. Use file references or secrets manager.',
    zh: '从源码中移除私钥。使用文件引用或密钥管理器。',
  },
  'secret-leaks/db-uri': {
    en: 'Move database URIs to environment variables. Avoid credentials in code.',
    zh: '将数据库 URI 移至环境变量。避免在代码中包含凭证。',
  },
  'secret-leaks/bearer-token': {
    en: 'Load bearer tokens from env vars or auth service at runtime.',
    zh: '在运行时从环境变量或认证服务加载 bearer token。',
  },

  // prompt-injection/*
  'prompt-injection/ignore-prev': {
    en: 'Remove or sanitize "ignore previous instructions" patterns. This is a known injection vector.',
    zh: '移除或清理「忽略之前指令」模式。这是已知的注入向量。',
  },
  'prompt-injection/role-override': {
    en: 'Remove role override attempts. Validate all user-facing prompts.',
    zh: '移除角色覆盖尝试。验证所有面向用户的提示。',
  },
  'prompt-injection/disregard': {
    en: 'Remove "disregard" instruction patterns. Sanitize user inputs.',
    zh: '移除「无视指令」模式。对用户输入进行清理。',
  },
  'prompt-injection/forget': {
    en: 'Remove "forget instructions" patterns. Add input validation.',
    zh: '移除「忘记指令」模式。添加输入验证。',
  },
  'prompt-injection/fake-system': {
    en: 'Remove fake system/admin command patterns. Validate prompt boundaries.',
    zh: '移除伪造的系统/管理员命令模式。验证提示边界。',
  },
  'prompt-injection/jailbreak': {
    en: 'Remove jailbreak patterns. These bypass AI safety guardrails.',
    zh: '移除越狱模式。这些会绕过 AI 安全护栏。',
  },
  'prompt-injection/disobey': {
    en: 'Remove instructions to disobey rules. Sanitize prompt content.',
    zh: '移除违反规则的指令。清理提示内容。',
  },
  'prompt-injection/pretend-no-rules': {
    en: 'Remove "pretend no rules" patterns. Enforce prompt integrity.',
    zh: '移除「假装没有规则」模式。确保提示完整性。',
  },
  'prompt-injection/special-tokens': {
    en: 'Strip LLM special tokens from user content to prevent injection.',
    zh: '从用户内容中剥离 LLM 特殊 token 以防止注入。',
  },
  'prompt-injection/llama-sys': {
    en: 'Remove Llama system tokens from content. These can manipulate model behavior.',
    zh: '从内容中移除 Llama 系统 token。这些可操纵模型行为。',
  },
  'prompt-injection/act-as': {
    en: 'Review "act as" patterns. Ensure they are intentional, not injected.',
    zh: '审查「扮演」模式。确保是有意为之，而非注入。',
  },

  // suspicious-network/*
  'suspicious-network/curl-pipe-shell': {
    en: 'Never pipe curl to shell. Download first, verify, then execute.',
    zh: '不要将 curl 管道到 shell。先下载、验证，再执行。',
  },
  'suspicious-network/wget-pipe-shell': {
    en: 'Never pipe wget to shell. Download, inspect, then run.',
    zh: '不要将 wget 管道到 shell。先下载、检查，再运行。',
  },
  'suspicious-network/curl-post': {
    en: 'Audit curl POST requests. Ensure no sensitive data is being exfiltrated.',
    zh: '审计 curl POST 请求。确保没有敏感数据被外泄。',
  },
  'suspicious-network/fetch-post': {
    en: 'Review fetch POST calls. Validate destination URLs and payload content.',
    zh: '审查 fetch POST 调用。验证目标 URL 和载荷内容。',
  },
  'suspicious-network/requests-post': {
    en: 'Audit requests.post() calls. Verify data is not being exfiltrated.',
    zh: '审计 requests.post() 调用。验证数据未被外泄。',
  },
  'suspicious-network/raw-ip': {
    en: 'Replace raw IP addresses with domain names. Raw IPs may indicate C2 servers.',
    zh: '用域名替代原始 IP 地址。原始 IP 可能指向 C2 服务器。',
  },
  'suspicious-network/tunnel': {
    en: 'Remove tunnel services (ngrok, etc.). These can expose internal services.',
    zh: '移除隧道服务（ngrok 等）。这些可暴露内部服务。',
  },
  'suspicious-network/paste-service': {
    en: 'Avoid paste/file sharing services in production code. Use proper APIs.',
    zh: '在生产代码中避免使用粘贴/文件共享服务。使用正规 API。',
  },
  'suspicious-network/webhook-test': {
    en: 'Remove webhook testing services. Use proper logging instead.',
    zh: '移除 webhook 测试服务。使用正规日志替代。',
  },
  'suspicious-network/dns-override': {
    en: 'Avoid hardcoded DNS resolvers unless explicitly required.',
    zh: '除非明确需要，避免硬编码 DNS 解析器。',
  },

  // permission-audit/*
  'permission-audit/filesystem': {
    en: 'Declare filesystem access in skill manifest. Minimize file operations.',
    zh: '在 skill 清单中声明文件系统访问。最小化文件操作。',
  },
  'permission-audit/network': {
    en: 'Declare network access in skill manifest. Restrict to necessary endpoints.',
    zh: '在 skill 清单中声明网络访问。限制为必要的端点。',
  },
  'permission-audit/exec': {
    en: 'Declare command execution in skill manifest. Use allowlists for commands.',
    zh: '在 skill 清单中声明命令执行权限。使用命令白名单。',
  },
  'permission-audit/env': {
    en: 'Declare env var access in skill manifest. List required variables.',
    zh: '在 skill 清单中声明环境变量访问。列出所需变量。',
  },
  'permission-audit/crypto': {
    en: 'Declare crypto usage in skill manifest. Document the purpose.',
    zh: '在 skill 清单中声明加密操作。记录其用途。',
  },
  'permission-audit/database': {
    en: 'Declare database access in skill manifest. Use least-privilege credentials.',
    zh: '在 skill 清单中声明数据库访问。使用最小权限凭证。',
  },
};

const FALLBACK = {
  en: 'Review this finding and apply appropriate security measures.',
  zh: '审查此发现并采取适当的安全措施。',
};

export function getSuggestion(ruleId) {
  return SUGGESTIONS[ruleId] || FALLBACK;
}
