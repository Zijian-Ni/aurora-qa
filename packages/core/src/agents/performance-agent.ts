import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  PerformanceAnalysis,
  PerformanceIssue,
  Optimization,
  BenchmarkResult,
} from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'report_complexity',
    description: 'Report time and space complexity analysis',
    input_schema: {
      type: 'object' as const,
      properties: {
        timeComplexity: { type: 'string', description: 'Big O time complexity' },
        spaceComplexity: { type: 'string', description: 'Big O space complexity' },
        reasoning: { type: 'string' },
      },
      required: ['timeComplexity', 'spaceComplexity', 'reasoning'],
    },
  },
  {
    name: 'report_issue',
    description: 'Report a performance issue',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['n-plus-one', 'memory-leak', 'blocking-operation', 'inefficient-algorithm', 'other'] },
        description: { type: 'string' },
        location: { type: 'string' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
      },
      required: ['type', 'description', 'location', 'severity'],
    },
  },
  {
    name: 'suggest_optimization',
    description: 'Suggest a performance optimization',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string' },
        impact: { type: 'string', enum: ['high', 'medium', 'low'] },
        before: { type: 'string', description: 'Code before optimization' },
        after: { type: 'string', description: 'Code after optimization' },
      },
      required: ['description', 'impact'],
    },
  },
  {
    name: 'finalize_analysis',
    description: 'Finalize the performance analysis',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Performance Agent — an expert in code performance analysis.

Analyze code for:
1. Time and space complexity (Big O notation)
2. N+1 query patterns (ORM/database access in loops)
3. Memory leaks (uncleaned event listeners, closures holding large objects)
4. Blocking operations (sync I/O in async contexts, heavy computation on main thread)
5. Inefficient algorithms and data structures

Process:
1. Call report_complexity with Big O analysis
2. Call report_issue for each performance problem found
3. Call suggest_optimization for actionable improvements with before/after code
4. Call finalize_analysis with a summary`;

export class PerformanceAgent extends BaseAgent {
  private analysis: PerformanceAnalysis = {
    timeComplexity: '',
    spaceComplexity: '',
    issues: [],
    optimizations: [],
  };

  constructor(config: AuroraConfig) {
    super({
      role: 'performance-agent',
      name: 'PerformanceAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async analyzeTimeComplexity(code: string, language?: string): Promise<{ time: string; space: string }> {
    this.analysis = { timeComplexity: '', spaceComplexity: '', issues: [], optimizations: [] };
    this.clearHistory();

    const prompt = [
      `Analyze the time and space complexity of this ${language ?? 'code'}.`,
      ``,
      '```',
      code,
      '```',
      ``,
      `Call report_complexity with your analysis, then finalize_analysis.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 6 });
    return { time: this.analysis.timeComplexity, space: this.analysis.spaceComplexity };
  }

  detectNPlusOneQueries(code: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = code.split('\n');

    const loopPatterns = [/for\s*\(/, /\.forEach\(/, /\.map\(/, /while\s*\(/];
    const queryPatterns = [
      /\.find\(/, /\.findOne\(/, /\.findById\(/, /\.query\(/, /\.execute\(/,
      /\.get\(/, /\.fetch\(/, /await\s+.*\.select\(/, /\.findAll\(/,
    ];

    let inLoop = false;
    let loopDepth = 0;
    let loopStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (loopPatterns.some(p => p.test(line))) {
        if (!inLoop) loopStartLine = i + 1;
        inLoop = true;
        loopDepth++;
      }

      if (inLoop) {
        const braces = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
        if (braces < 0) loopDepth += braces;
        if (loopDepth <= 0) { inLoop = false; loopDepth = 0; }
      }

      if (inLoop && queryPatterns.some(p => p.test(line))) {
        issues.push({
          type: 'n-plus-one',
          description: `Database query inside loop starting at line ${loopStartLine}`,
          location: `line ${i + 1}`,
          severity: 'high',
        });
      }
    }

    return issues;
  }

  detectMemoryLeaks(code: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = code.split('\n');

    const addListenerPattern = /\.(?:addEventListener|on)\s*\(/;
    const removeListenerPattern = /\.(?:removeEventListener|off|removeListener)\s*\(/;

    let hasAddListener = false;
    let hasRemoveListener = false;

    for (let i = 0; i < lines.length; i++) {
      if (addListenerPattern.test(lines[i]!)) hasAddListener = true;
      if (removeListenerPattern.test(lines[i]!)) hasRemoveListener = true;
    }

    if (hasAddListener && !hasRemoveListener) {
      issues.push({
        type: 'memory-leak',
        description: 'Event listeners are added but never removed — potential memory leak',
        location: 'file scope',
        severity: 'medium',
      });
    }

    // Check for closures holding large arrays/objects in timers
    const timerWithClosure = /(?:setInterval|setTimeout)\s*\(\s*(?:function|\()/;
    for (let i = 0; i < lines.length; i++) {
      if (timerWithClosure.test(lines[i]!) && /setInterval/.test(lines[i]!)) {
        issues.push({
          type: 'memory-leak',
          description: 'setInterval closure may hold references preventing garbage collection',
          location: `line ${i + 1}`,
          severity: 'medium',
        });
      }
    }

    return issues;
  }

  detectBlockingOperations(code: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = code.split('\n');

    const syncPatterns = [
      { pattern: /readFileSync/g, name: 'readFileSync' },
      { pattern: /writeFileSync/g, name: 'writeFileSync' },
      { pattern: /execSync/g, name: 'execSync' },
      { pattern: /spawnSync/g, name: 'spawnSync' },
      { pattern: /existsSync/g, name: 'existsSync' },
    ];

    let inAsyncContext = false;

    for (let i = 0; i < lines.length; i++) {
      if (/async\s+/.test(lines[i]!) || /=>\s*\{/.test(lines[i]!)) {
        inAsyncContext = true;
      }

      for (const { pattern, name } of syncPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i]!)) {
          issues.push({
            type: 'blocking-operation',
            description: `Synchronous operation ${name} ${inAsyncContext ? 'in async context' : 'detected'}`,
            location: `line ${i + 1}`,
            severity: inAsyncContext ? 'high' : 'medium',
          });
        }
      }
    }

    return issues;
  }

  async suggestOptimizations(code: string, language?: string): Promise<Optimization[]> {
    this.analysis = { timeComplexity: '', spaceComplexity: '', issues: [], optimizations: [] };
    this.clearHistory();

    const prompt = [
      `Analyze this ${language ?? 'code'} for performance optimizations.`,
      ``,
      '```',
      code,
      '```',
      ``,
      `Call suggest_optimization for each improvement, then finalize_analysis.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 10 });
    return this.analysis.optimizations;
  }

  benchmarkFunction(code: string, iterations = 1000): BenchmarkResult {
    const times: number[] = [];

    try {
      const fn = new Function(`return (${code})`)();
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
      }
    } catch {
      // Function cannot be evaluated, return empty metrics
      return { iterations: 0, p50: 0, p95: 0, p99: 0, mean: 0, min: 0, max: 0 };
    }

    times.sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      iterations,
      p50: times[Math.floor(times.length * 0.5)] ?? 0,
      p95: times[Math.floor(times.length * 0.95)] ?? 0,
      p99: times[Math.floor(times.length * 0.99)] ?? 0,
      mean: sum / times.length,
      min: times[0] ?? 0,
      max: times[times.length - 1] ?? 0,
    };
  }

  async analyze(code: string, language?: string): Promise<PerformanceAnalysis> {
    this.analysis = { timeComplexity: '', spaceComplexity: '', issues: [], optimizations: [] };

    // Pattern-based detection
    this.analysis.issues.push(
      ...this.detectNPlusOneQueries(code),
      ...this.detectMemoryLeaks(code),
      ...this.detectBlockingOperations(code),
    );

    // AI analysis
    this.clearHistory();
    const prompt = [
      `Perform a complete performance analysis of this ${language ?? 'code'}.`,
      ``,
      `I've already found ${this.analysis.issues.length} issues via pattern matching.`,
      ``,
      '```',
      code,
      '```',
      ``,
      `1. Call report_complexity with Big O analysis`,
      `2. Call report_issue for additional performance problems`,
      `3. Call suggest_optimization for improvements`,
      `4. Call finalize_analysis`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 12 });
    return this.analysis;
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'report_complexity': {
        this.analysis.timeComplexity = String(input['timeComplexity'] ?? '');
        this.analysis.spaceComplexity = String(input['spaceComplexity'] ?? '');
        return { success: true };
      }
      case 'report_issue': {
        this.analysis.issues.push({
          type: input['type'] as PerformanceIssue['type'],
          description: String(input['description'] ?? ''),
          location: String(input['location'] ?? ''),
          severity: input['severity'] as PerformanceIssue['severity'],
        });
        return { success: true, issueCount: this.analysis.issues.length };
      }
      case 'suggest_optimization': {
        this.analysis.optimizations.push({
          description: String(input['description'] ?? ''),
          impact: input['impact'] as Optimization['impact'],
          before: input['before'] as string | undefined,
          after: input['after'] as string | undefined,
        });
        return { success: true, optimizationCount: this.analysis.optimizations.length };
      }
      case 'finalize_analysis': {
        return { success: true, summary: input['summary'] };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
