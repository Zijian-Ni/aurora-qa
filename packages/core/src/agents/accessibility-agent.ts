import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type { AuroraConfig, A11yFinding, A11yReport, A11ySeverity } from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'report_a11y_finding',
    description: 'Report an accessibility finding',
    input_schema: {
      type: 'object' as const,
      properties: {
        criterion: { type: 'string', description: 'WCAG criterion (e.g. 1.1.1)' },
        severity: { type: 'string', enum: ['must-fix', 'should-fix', 'nice-to-have'] },
        description: { type: 'string' },
        element: { type: 'string', description: 'The HTML element or component' },
        suggestion: { type: 'string' },
        fixCode: { type: 'string' },
      },
      required: ['criterion', 'severity', 'description', 'suggestion'],
    },
  },
  {
    name: 'finalize_a11y_report',
    description: 'Finalize the accessibility report',
    input_schema: {
      type: 'object' as const,
      properties: {
        score: { type: 'number', description: 'Accessibility score 0-100' },
        level: { type: 'string', enum: ['A', 'AA', 'AAA'] },
        summary: { type: 'string' },
      },
      required: ['score', 'level', 'summary'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Accessibility Agent — a WCAG 2.1 AA compliance checker.

Analyze HTML and React code for accessibility issues including:
- Missing alt text on images (WCAG 1.1.1)
- Missing form labels (WCAG 1.3.1)
- Missing aria-label/aria-labelledby (WCAG 4.1.2)
- Heading hierarchy issues (WCAG 1.3.1)
- Color contrast hints (WCAG 1.4.3)
- Missing keyboard event handlers (WCAG 2.1.1)
- Missing focus management (WCAG 2.4.3)
- Missing lang attribute (WCAG 3.1.1)
- Interactive elements without roles (WCAG 4.1.2)

Severity:
- must-fix: Blocks access for users with disabilities
- should-fix: Degrades experience significantly
- nice-to-have: Minor improvement

Process:
1. Call report_a11y_finding for each issue
2. Call finalize_a11y_report with overall assessment`;

// Pattern-based HTML accessibility checks
const A11Y_HTML_PATTERNS = [
  { pattern: /<img(?![^>]*alt=)/gi, criterion: '1.1.1', desc: 'Image missing alt attribute', severity: 'must-fix' as A11ySeverity },
  { pattern: /<input(?![^>]*(?:aria-label|id))[^>]*>/gi, criterion: '1.3.1', desc: 'Input missing label association', severity: 'must-fix' as A11ySeverity },
  { pattern: /<html(?![^>]*lang=)/gi, criterion: '3.1.1', desc: 'HTML missing lang attribute', severity: 'must-fix' as A11ySeverity },
  { pattern: /<(?:div|span)\s+onclick/gi, criterion: '4.1.2', desc: 'Non-interactive element has click handler — use button instead', severity: 'should-fix' as A11ySeverity },
  { pattern: /tabindex=["']?[2-9]\d*/gi, criterion: '2.4.3', desc: 'Positive tabindex disrupts natural tab order', severity: 'should-fix' as A11ySeverity },
  { pattern: /<a(?![^>]*href)[^>]*>/gi, criterion: '2.1.1', desc: 'Anchor tag missing href — not keyboard accessible', severity: 'must-fix' as A11ySeverity },
];

// React-specific patterns
const A11Y_REACT_PATTERNS = [
  { pattern: /<img(?![^>]*alt[=\s{])/g, criterion: '1.1.1', desc: 'React img missing alt prop', severity: 'must-fix' as A11ySeverity },
  { pattern: /onClick=\{[^}]*\}(?![^>]*(?:onKeyDown|onKeyPress|onKeyUp))/g, criterion: '2.1.1', desc: 'onClick without keyboard event handler', severity: 'should-fix' as A11ySeverity },
  { pattern: /<(?:div|span)\s[^>]*onClick/g, criterion: '4.1.2', desc: 'Non-semantic element with onClick — add role="button" or use <button>', severity: 'should-fix' as A11ySeverity },
];

export class AccessibilityAgent extends BaseAgent {
  private findings: A11yFinding[] = [];
  private reportResult: Partial<A11yReport> = {};

  constructor(config: AuroraConfig) {
    super({
      role: 'accessibility-agent',
      name: 'AccessibilityAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  analyzeHTMLAccessibility(html: string): A11yFinding[] {
    const findings: A11yFinding[] = [];

    for (const { pattern, criterion, desc, severity } of A11Y_HTML_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(html)) !== null) {
        findings.push({
          criterion,
          severity,
          description: desc,
          element: match[0].slice(0, 80),
          suggestion: `Fix: ${desc}`,
        });
      }
    }

    // Check heading hierarchy
    const headings = [...html.matchAll(/<h([1-6])/gi)].map(m => Number(m[1]));
    for (let i = 1; i < headings.length; i++) {
      if (headings[i]! - headings[i - 1]! > 1) {
        findings.push({
          criterion: '1.3.1',
          severity: 'should-fix',
          description: `Heading hierarchy skips from h${headings[i - 1]} to h${headings[i]}`,
          suggestion: 'Ensure headings follow a logical order without skipping levels',
        });
      }
    }

    return findings;
  }

  analyzeReactComponents(code: string): A11yFinding[] {
    const findings: A11yFinding[] = [];

    for (const { pattern, criterion, desc, severity } of A11Y_REACT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(code)) !== null) {
        findings.push({
          criterion,
          severity,
          description: desc,
          element: match[0].slice(0, 80),
          suggestion: `Fix: ${desc}`,
        });
      }
    }

    return findings;
  }

  async generateA11yReport(code: string, isReact = false): Promise<A11yReport> {
    this.findings = [];
    this.reportResult = {};

    // Pattern-based scan
    const patternFindings = isReact
      ? [...this.analyzeHTMLAccessibility(code), ...this.analyzeReactComponents(code)]
      : this.analyzeHTMLAccessibility(code);
    this.findings.push(...patternFindings);

    // AI analysis
    this.clearHistory();
    const prompt = [
      `Analyze this ${isReact ? 'React component' : 'HTML'} for WCAG 2.1 AA compliance.`,
      ``,
      `I've already found ${patternFindings.length} issues via pattern matching.`,
      ``,
      '```',
      code,
      '```',
      ``,
      `Report additional findings with report_a11y_finding, then finalize_a11y_report.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 10 });

    return {
      findings: this.findings,
      score: this.reportResult.score ?? Math.max(0, 100 - this.findings.length * 10),
      level: this.reportResult.level ?? 'AA',
      summary: this.reportResult.summary ?? `Found ${this.findings.length} accessibility issues`,
    };
  }

  suggestFixes(findings: A11yFinding[]): Array<A11yFinding & { fixCode: string }> {
    return findings
      .filter(f => f.fixCode)
      .map(f => ({ ...f, fixCode: f.fixCode! }));
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'report_a11y_finding': {
        this.findings.push({
          criterion: String(input['criterion'] ?? ''),
          severity: input['severity'] as A11ySeverity,
          description: String(input['description'] ?? ''),
          element: input['element'] as string | undefined,
          suggestion: String(input['suggestion'] ?? ''),
          fixCode: input['fixCode'] as string | undefined,
        });
        return { success: true, count: this.findings.length };
      }
      case 'finalize_a11y_report': {
        this.reportResult = {
          score: Number(input['score'] ?? 0),
          level: input['level'] as A11yReport['level'],
          summary: String(input['summary'] ?? ''),
        };
        return { success: true };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
