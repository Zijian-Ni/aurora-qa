import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type { AuroraConfig, SecurityFinding, SecurityReport, SecuritySeverity } from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'report_finding',
    description: 'Report a security finding',
    input_schema: {
      type: 'object' as const,
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        category: { type: 'string', description: 'OWASP category or general category' },
        description: { type: 'string' },
        line: { type: 'number' },
        recommendation: { type: 'string' },
        owaspCategory: { type: 'string' },
      },
      required: ['severity', 'category', 'description', 'recommendation'],
    },
  },
  {
    name: 'finalize_report',
    description: 'Finalize the security report with a summary',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string' },
        riskScore: { type: 'number', description: 'Overall risk score 0-100' },
      },
      required: ['summary', 'riskScore'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Security Agent — an OWASP-aligned security scanner.

Analyze code for security vulnerabilities including:
- SQL Injection (A03:2021)
- Cross-Site Scripting / XSS (A03:2021)
- Broken Authentication (A07:2021)
- Sensitive Data Exposure / Secrets in Code (A02:2021)
- Insecure Dependencies (A06:2021)
- Security Misconfiguration (A05:2021)

Process:
1. Analyze the provided code thoroughly
2. Call report_finding for each vulnerability found
3. Call finalize_report with summary and risk score

Be thorough but avoid false positives. Rate severity accurately.`;

// Pattern-based scanners (no AI needed)
const SQL_INJECTION_PATTERNS = [
  /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/gi,
  /\+\s*['"].*(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b/gi,
  /`.*\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
  /query\s*\(\s*['"`].*\+/gi,
  /exec\s*\(\s*['"`].*\+/gi,
];

const XSS_PATTERNS = [
  /innerHTML\s*=/gi,
  /outerHTML\s*=/gi,
  /document\.write\s*\(/gi,
  /dangerouslySetInnerHTML/gi,
  /eval\s*\(/gi,
  /new\s+Function\s*\(/gi,
  /setTimeout\s*\(\s*['"`]/gi,
  /setInterval\s*\(\s*['"`]/gi,
];

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi, name: 'API Key' },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, name: 'Password' },
  { pattern: /(?:secret|token)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi, name: 'Secret/Token' },
  { pattern: /(?:aws_access_key_id)\s*[:=]\s*['"]AKIA[A-Z0-9]{16}['"]/gi, name: 'AWS Access Key' },
  { pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g, name: 'Private Key' },
  { pattern: /ghp_[A-Za-z0-9_]{36}/g, name: 'GitHub Token' },
  { pattern: /sk-[A-Za-z0-9]{48}/g, name: 'API Secret Key' },
];

const AUTH_PATTERNS = [
  /(?:app|router)\s*\.(?:get|post|put|delete|patch)\s*\([^)]*(?:admin|user|account|settings)/gi,
  /(?:cors)\s*\(\s*\{\s*origin\s*:\s*['"]\*/gi,
];

export class SecurityAgent extends BaseAgent {
  private findings: SecurityFinding[] = [];
  private reportSummary = '';
  private reportRiskScore = 0;

  constructor(config: AuroraConfig) {
    super({
      role: 'security-agent',
      name: 'SecurityAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  scanForSQLInjection(code: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i]!)) {
          findings.push({
            severity: 'critical',
            category: 'SQL Injection',
            location: { line: i + 1 },
            description: `Potential SQL injection: string concatenation in SQL query`,
            recommendation: 'Use parameterized queries or prepared statements instead of string concatenation',
            owaspCategory: 'A03:2021 Injection',
          });
        }
      }
    }
    return findings;
  }

  scanForXSS(code: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of XSS_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i]!)) {
          const match = lines[i]!.trim();
          findings.push({
            severity: match.includes('eval') || match.includes('Function') ? 'critical' : 'high',
            category: 'Cross-Site Scripting',
            location: { line: i + 1 },
            description: `Potential XSS vulnerability: ${match.slice(0, 80)}`,
            recommendation: 'Sanitize user input before rendering. Use textContent instead of innerHTML.',
            owaspCategory: 'A03:2021 Injection',
          });
        }
      }
    }
    return findings;
  }

  scanForSecretsInCode(code: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, name } of SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i]!)) {
          findings.push({
            severity: 'critical',
            category: 'Sensitive Data Exposure',
            location: { line: i + 1 },
            description: `Hardcoded ${name} found in source code`,
            recommendation: 'Move secrets to environment variables or a secrets manager',
            owaspCategory: 'A02:2021 Cryptographic Failures',
          });
        }
      }
    }
    return findings;
  }

  scanForInsecureDependencies(packageJson: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    try {
      const pkg = JSON.parse(packageJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const [name, version] of Object.entries(deps)) {
        const ver = String(version);
        if (ver === '*' || ver === 'latest') {
          findings.push({
            severity: 'medium',
            category: 'Insecure Dependencies',
            location: {},
            description: `Unpinned dependency: ${name}@${ver}`,
            recommendation: `Pin ${name} to a specific version range`,
            owaspCategory: 'A06:2021 Vulnerable and Outdated Components',
          });
        }
      }
    } catch {
      // Invalid JSON, skip
    }
    return findings;
  }

  scanForAuthIssues(code: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of AUTH_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i]!)) {
          findings.push({
            severity: 'medium',
            category: 'Broken Access Control',
            location: { line: i + 1 },
            description: `Potential auth issue: ${lines[i]!.trim().slice(0, 80)}`,
            recommendation: 'Ensure proper authentication and authorization middleware is applied',
            owaspCategory: 'A01:2021 Broken Access Control',
          });
        }
      }
    }
    return findings;
  }

  async generateSecurityReport(code: string, filePath?: string): Promise<SecurityReport> {
    this.findings = [];
    this.reportSummary = '';
    this.reportRiskScore = 0;

    // Run pattern-based scans first
    const patternFindings = [
      ...this.scanForSQLInjection(code),
      ...this.scanForXSS(code),
      ...this.scanForSecretsInCode(code),
      ...this.scanForAuthIssues(code),
    ];
    this.findings.push(...patternFindings);

    // Use AI for deeper analysis
    this.clearHistory();
    const prompt = [
      `Perform a thorough security analysis of this code.`,
      filePath ? `**File:** ${filePath}` : '',
      ``,
      `I've already found ${patternFindings.length} issues via pattern matching.`,
      `Look for additional security issues that pattern matching would miss.`,
      ``,
      '```',
      code,
      '```',
      ``,
      `Report additional findings with report_finding, then call finalize_report.`,
    ].filter(Boolean).join('\n');

    await this.runLoop(prompt, { maxIterations: 10 });

    return {
      findings: this.findings,
      summary: this.reportSummary || `Found ${this.findings.length} security issues`,
      riskScore: this.reportRiskScore || Math.min(100, this.findings.length * 15),
      scannedAt: new Date(),
    };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'report_finding': {
        const finding: SecurityFinding = {
          severity: input['severity'] as SecuritySeverity,
          category: String(input['category'] ?? ''),
          location: { line: input['line'] as number | undefined },
          description: String(input['description'] ?? ''),
          recommendation: String(input['recommendation'] ?? ''),
          owaspCategory: input['owaspCategory'] as string | undefined,
        };
        this.findings.push(finding);
        return { success: true, findingIndex: this.findings.length };
      }
      case 'finalize_report': {
        this.reportSummary = String(input['summary'] ?? '');
        this.reportRiskScore = Number(input['riskScore'] ?? 0);
        return { success: true };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
