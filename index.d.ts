// Type declarations for skill-audit

/** A single security finding from a scan */
export interface Finding {
  /** Rule identifier (e.g. "dangerous-commands/rm-rf") */
  rule: string;
  /** Severity level */
  severity: 'danger' | 'warn';
  /** Relative file path */
  file: string;
  /** 1-based line number */
  line: number;
  /** Human-readable description */
  msg: string;
  /** Code snippet (max 120 chars) */
  snippet: string;
  /** Fix suggestion */
  fix?: string;
  /** Alias for msg (used by some rules) */
  message?: string;
}

/** Score breakdown for a severity level */
export interface SeverityBreakdown {
  count: number;
  deduction: number;
}

/** Security score result */
export interface Score {
  /** Score from 0 to 100 */
  score: number;
  /** Letter grade */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    danger: SeverityBreakdown;
    warn: SeverityBreakdown;
    totalDeduction: number;
  };
}

/** Scan summary counts */
export interface Summary {
  /** 1 if no findings, 0 otherwise */
  pass: number;
  /** Number of warn-level findings */
  warn: number;
  /** Number of danger-level findings */
  danger: number;
  /** Number of files scanned */
  files: number;
}

/** Timing information for a scan */
export interface Timing {
  /** Total scan time in milliseconds */
  totalMs: number;
  /** File reading time in milliseconds */
  filesMs: number;
  /** Rule execution time in milliseconds */
  rulesMs: number;
}

/** Parsed skill manifest information */
export interface Manifest {
  format: 'openclaw' | 'langchain' | 'crewai';
  name: string;
  description: string;
  declaredPermissions: string[];
}

/** Full scan report */
export interface Report {
  /** Scanned directory path */
  target: string;
  /** List of scanned file paths (relative) */
  files: string[];
  /** Security findings, sorted by severity */
  findings: Finding[];
  /** Summary counts */
  summary: Summary;
  /** Timing information */
  timing: Timing;
  /** Manifest info (if detected) */
  manifest?: {
    format: string;
    name: string;
    description: string;
    declaredPermissions: string[];
  };
}

/** Diff result comparing two reports */
export interface DiffResult {
  /** New findings not in old report */
  added: Finding[];
  /** Findings present in old but not new */
  fixed: Finding[];
  /** Findings present in both */
  kept: Finding[];
  score: {
    old: number;
    new: number;
    /** Positive = improvement */
    delta: number;
  };
  grade: {
    old: string;
    new: string;
  };
  summary: {
    addedCount: number;
    fixedCount: number;
    keptCount: number;
  };
}

/** File info passed to rule scan functions */
export interface FileInfo {
  /** Absolute path */
  path: string;
  /** Relative path from scan target */
  rel: string;
  /** File extension (e.g. ".js") */
  ext: string;
}

/** Context passed to rule scan functions */
export interface ScanContext {
  manifest?: Manifest | null;
}

/** A custom rule plugin */
export interface Rule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Scan function that returns findings */
  scan(content: string, file: FileInfo, ctx?: ScanContext): Finding[] | Promise<Finding[]>;
}

/** Configuration object */
export interface Config {
  /** Enable/disable rules by ID */
  rules: Record<string, boolean>;
  /** Override severity for rules */
  severity: Record<string, 'warn' | 'danger'>;
  /** Glob patterns to ignore */
  ignore: string[];
  /** Plugin directory path */
  plugins: string | null;
}

/** History save result */
export interface SaveResult {
  path: string;
  timestamp: number;
}

/**
 * Scan a skill directory for security issues.
 * @param targetPath - Absolute path to the skill directory
 */
export function audit(targetPath: string): Promise<Report>;

/**
 * Calculate a security score from findings.
 * @param findings - Array of scan findings
 */
export function calculateScore(findings: Finding[]): Score;

/**
 * Generate a shields.io-style SVG badge.
 * @param score - Security score (0-100)
 * @param grade - Security grade
 */
export function generateBadge(score: number, grade: string): string;

/**
 * Compare two audit reports.
 * @param oldReport - Previous scan report
 * @param newReport - Current scan report
 */
export function diffReports(oldReport: Report, newReport: Report): DiffResult;

/**
 * Save a scan report to history.
 * @param targetDir - The scanned skill directory
 * @param report - The report to save
 */
export function saveReport(targetDir: string, report: Report): Promise<SaveResult>;

/**
 * Load scan history, newest first.
 * @param targetDir - The scanned skill directory
 * @param limit - Max reports to return
 */
export function loadHistory(targetDir: string, limit?: number): Promise<Report[]>;

/**
 * Get the most recent scan report.
 * @param targetDir - The scanned skill directory
 */
export function getLatest(targetDir: string): Promise<Report | null>;

/**
 * Load configuration from file or defaults.
 * @param targetDir - The skill directory being scanned
 * @param configPath - Optional explicit config file path
 */
export function loadConfig(targetDir: string, configPath?: string): Promise<Config>;

/**
 * Load custom rule plugins from a directory.
 * @param pluginDir - Path to the plugin directory
 */
export function loadPlugins(pluginDir: string): Promise<Rule[]>;

/**
 * Create an HTTP server for the skill-audit API.
 * @param options - Server configuration
 */
export function createServer(options?: {
  rateLimit?: number;
  rateWindow?: number;
  maxConcurrent?: number;
}): import('http').Server;
