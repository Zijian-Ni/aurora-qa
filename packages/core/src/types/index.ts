// ─── Agent Types ─────────────────────────────────────────────────────────────

export type AgentRole =
  | 'test-generator'
  | 'test-runner'
  | 'bug-analyzer'
  | 'coverage-agent'
  | 'review-agent';

export type AgentStatus = 'idle' | 'running' | 'error' | 'completed';

export interface AgentInfo {
  id: string;
  role: AgentRole;
  name: string;
  status: AgentStatus;
}

export interface AgentEvent {
  agentId: string;
  type: 'statusChange' | 'toolCall' | 'response' | 'error';
  payload: unknown;
  timestamp: Date;
}

// ─── Test Types ───────────────────────────────────────────────────────────────

export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'jasmine' | 'node:test';
export type TestStatus = 'pending' | 'passing' | 'failing' | 'skipped' | 'error';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  code: string;
  filePath: string;
  framework: TestFramework;
  status: TestStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestResult {
  id: string;
  testCaseId: string;
  runId: string;
  status: TestStatus;
  durationMs: number;
  error?: string;
  errorStack?: string;
  output: string;
  timestamp: Date;
}

export interface TestSuite {
  id: string;
  name: string;
  filePath: string;
  testIds: string[];
  framework: TestFramework;
  createdAt: Date;
}

export interface GenerateTestsInput {
  sourceCode: string;
  filePath: string;
  framework?: TestFramework;
  existingTests?: string;
  focusAreas?: string[];
  maxTests?: number;
}

export interface GenerateTestsOutput {
  tests: TestCase[];
  testCode: string;
  framework: TestFramework;
  coverage_targets: string[];
}

export interface RunTestsInput {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface RunTestsOutput {
  results: TestResult[];
  summary: TestSummary;
  rawOutput: string;
  durationMs: number;
}

export interface TestSummary {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  errors: number;
  passRate: number;
}

// ─── Bug Types ────────────────────────────────────────────────────────────────

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type BugStatus = 'open' | 'in-progress' | 'resolved' | 'wontfix' | 'duplicate';
export type BugCategory =
  | 'null-pointer'
  | 'race-condition'
  | 'memory-leak'
  | 'security'
  | 'logic-error'
  | 'type-error'
  | 'performance'
  | 'edge-case'
  | 'other';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: BugSeverity;
  category: BugCategory;
  status: BugStatus;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  codeSnippet?: string;
  stackTrace?: string;
  reproducibleSteps?: string[];
  suggestedFix?: string;
  fixCode?: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyzeBugsInput {
  code: string;
  filePath: string;
  language?: string;
  context?: string;
  testOutput?: string;
  errorMessage?: string;
}

export interface AnalyzeBugsOutput {
  bugs: BugReport[];
  riskScore: number;
  summary: string;
  recommendations: string[];
}

// ─── Coverage Types ───────────────────────────────────────────────────────────

export interface FileCoverage {
  filePath: string;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
  uncoveredItems: number[];
}

export interface CoverageReport {
  id: string;
  timestamp: Date;
  overall: OverallCoverage;
  files: FileCoverage[];
  thresholds: CoverageThresholds;
  meetsThresholds: boolean;
}

export interface OverallCoverage {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface AnalyzeCoverageInput {
  coverageJson?: string;
  coverageSummary?: string;
  sourceFiles?: Array<{ path: string; content: string }>;
  thresholds?: Partial<CoverageThresholds>;
}

export interface AnalyzeCoverageOutput {
  report: CoverageReport;
  gaps: CoverageGap[];
  suggestions: string[];
  prioritizedFiles: string[];
}

export interface CoverageGap {
  filePath: string;
  metric: keyof OverallCoverage;
  current: number;
  target: number;
  uncoveredItems: string[];
}

// ─── Code Review Types ────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'suggestion' | 'info';
export type IssueCategory =
  | 'correctness'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'style'
  | 'testability'
  | 'documentation';

export interface ReviewIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  lineStart?: number;
  lineEnd?: number;
  codeSnippet?: string;
  suggestion?: string;
  fixCode?: string;
  rule?: string;
}

export interface CodeReview {
  id: string;
  filePath: string;
  language: string;
  issues: ReviewIssue[];
  suggestions: string[];
  strengths: string[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  timestamp: Date;
}

export interface ReviewCodeInput {
  code: string;
  filePath: string;
  language?: string;
  context?: string;
  focusAreas?: IssueCategory[];
  strictness?: 'lenient' | 'standard' | 'strict';
}

export interface ReviewCodeOutput {
  review: CodeReview;
  criticalIssues: ReviewIssue[];
  quickWins: ReviewIssue[];
}

// ─── Pipeline Types ───────────────────────────────────────────────────────────

export type StepType =
  | 'generate-tests'
  | 'run-tests'
  | 'analyze-bugs'
  | 'check-coverage'
  | 'review-code';

export type PipelineStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineStep {
  id: string;
  type: StepType;
  name: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
  continueOnError?: boolean;
  timeoutMs?: number;
}

export interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'git-push' | 'pr-open' | 'pr-update';
  config?: Record<string, unknown>;
}

export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  triggers: PipelineTrigger[];
  environment: Record<string, string>;
  notifications?: NotificationConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationConfig {
  onSuccess?: boolean;
  onFailure?: boolean;
  webhookUrl?: string;
}

export interface PipelineStepRun {
  stepId: string;
  stepType: StepType;
  stepName: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  output?: unknown;
  error?: string;
}

export interface PipelineResults {
  testsGenerated?: number;
  testsPassing?: number;
  testsFailing?: number;
  testsTotal?: number;
  bugsFound?: number;
  bugsBySeverity?: Record<BugSeverity, number>;
  coveragePercent?: number;
  reviewScore?: number;
  reviewGrade?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: PipelineStatus;
  trigger: PipelineTrigger['type'];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  steps: PipelineStepRun[];
  results: PipelineResults;
  error?: string;
}

// ─── Memory Types ─────────────────────────────────────────────────────────────

export type MemoryEntryType =
  | 'test-pattern'
  | 'bug-pattern'
  | 'code-insight'
  | 'fix-recipe'
  | 'coverage-gap'
  | 'review-pattern';

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  vector: number[];
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  relevanceScore?: number;
}

export interface VectorSearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export interface KnowledgeQuery {
  query: string;
  type?: MemoryEntryType;
  tags?: string[];
  limit?: number;
  minSimilarity?: number;
}

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface AuroraConfig {
  anthropicApiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  memory: {
    maxEntries: number;
    similarityThreshold: number;
    persistPath?: string;
  };
  dashboard: {
    port: number;
    host: string;
    corsOrigins: string[];
  };
  mcp: {
    name: string;
    version: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'pretty';
  };
}
