// ─── Agent Types ─────────────────────────────────────────────────────────────

export type AgentRole =
  | 'test-generator'
  | 'test-runner'
  | 'bug-analyzer'
  | 'coverage-agent'
  | 'review-agent'
  | 'healer-agent'
  | 'playwright-agent'
  | 'security-agent'
  | 'performance-agent'
  | 'accessibility-agent'
  | 'chaos-agent'
  | 'mutation-agent'
  | 'contract-agent';

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

// ─── Healer Types ─────────────────────────────────────────────────────────────

export type FailureClassification =
  | 'selector_stale'
  | 'timing_race'
  | 'env_flakiness'
  | 'logic_change'
  | 'data_dependency'
  | 'unknown';

export interface HealingSuggestion {
  fix: string;
  confidence: number;
  strategy: string;
  patch?: Record<string, unknown>;
}

export interface HealingStats {
  totalAttempts: number;
  successRate: number;
  topStrategies: Array<{ strategy: string; count: number; successRate: number }>;
}

// ─── Security Types ───────────────────────────────────────────────────────────

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityFinding {
  severity: SecuritySeverity;
  category: string;
  location: { file?: string; line?: number; column?: number };
  description: string;
  recommendation: string;
  owaspCategory?: string;
}

export interface SecurityReport {
  findings: SecurityFinding[];
  summary: string;
  riskScore: number;
  scannedAt: Date;
}

// ─── Performance Types ────────────────────────────────────────────────────────

export interface PerformanceAnalysis {
  timeComplexity: string;
  spaceComplexity: string;
  issues: PerformanceIssue[];
  optimizations: Optimization[];
}

export interface PerformanceIssue {
  type: 'n-plus-one' | 'memory-leak' | 'blocking-operation' | 'inefficient-algorithm' | 'other';
  description: string;
  location: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface Optimization {
  description: string;
  impact: 'high' | 'medium' | 'low';
  before?: string;
  after?: string;
}

export interface BenchmarkResult {
  iterations: number;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

// ─── Accessibility Types ──────────────────────────────────────────────────────

export type A11ySeverity = 'must-fix' | 'should-fix' | 'nice-to-have';

export interface A11yFinding {
  criterion: string;
  severity: A11ySeverity;
  description: string;
  element?: string;
  suggestion: string;
  fixCode?: string;
}

export interface A11yReport {
  findings: A11yFinding[];
  score: number;
  level: 'A' | 'AA' | 'AAA';
  summary: string;
}

// ─── Chaos Types ──────────────────────────────────────────────────────────────

export type ChaosIntensity = 'mild' | 'moderate' | 'severe';

export interface ChaosConfig {
  experiments: ChaosExperiment[];
  duration: number;
  targetResilience: number;
}

export interface ChaosExperiment {
  type: 'network-latency' | 'network-failure' | 'cpu-stress' | 'memory-pressure' | 'random-error' | 'time-skew';
  config: Record<string, unknown>;
  description: string;
}

export interface ChaosReport {
  experiments: Array<ChaosExperiment & { result: string; impact: string }>;
  resilienceScore: number;
  recommendations: string[];
}

// ─── Mutation Testing Types ───────────────────────────────────────────────────

export type MutationType =
  | 'arithmetic'
  | 'boolean'
  | 'boundary'
  | 'return-value';

export interface Mutant {
  id: string;
  type: MutationType;
  original: string;
  mutated: string;
  location: { line: number; column: number };
  status: 'pending' | 'killed' | 'survived' | 'timeout' | 'error';
}

export interface MutationReport {
  mutants: Mutant[];
  score: number;
  killed: number;
  survived: number;
  total: number;
  weakSpots: string[];
}

// ─── Contract Testing Types ───────────────────────────────────────────────────

export interface ContractInteraction {
  description: string;
  request: { method: string; path: string; headers?: Record<string, string>; body?: unknown };
  response: { status: number; headers?: Record<string, string>; body?: unknown };
}

export interface APIContract {
  provider: string;
  consumer: string;
  interactions: ContractInteraction[];
  version: string;
  createdAt: Date;
}

export interface ContractVerificationResult {
  valid: boolean;
  failures: Array<{ interaction: string; expected: unknown; actual: unknown; error: string }>;
  summary: string;
}

export interface ContractBreak {
  type: 'removed-endpoint' | 'changed-response' | 'new-required-field' | 'type-change';
  description: string;
  breaking: boolean;
  path: string;
}

// ─── Episodic Memory Types ────────────────────────────────────────────────────

export interface Episode {
  id: string;
  type: string;
  content: string;
  tags: string[];
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TestPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  successRate: number;
  usageCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Reasoning Types ──────────────────────────────────────────────────────────

export interface ReasoningResult {
  steps: string[];
  conclusion: string;
  confidence: number;
  alternatives: string[];
}

// ─── Test Prioritization Types ────────────────────────────────────────────────

export interface PrioritizedTest {
  testId: string;
  testName: string;
  priority: number;
  factors: { changeProximity: number; failureRate: number; executionTime: number; businessCriticality: number };
}

// ─── Metrics Types ────────────────────────────────────────────────────────────

export interface MetricPoint {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

// ─── Event Stream Types ───────────────────────────────────────────────────────

export interface AuroraEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: Date;
  source: string;
}

// ─── CI/CD Adapter Types ──────────────────────────────────────────────────────

export interface CIAdapterResult {
  success: boolean;
  message: string;
  data?: unknown;
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
