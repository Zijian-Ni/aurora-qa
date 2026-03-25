// ─── Main entry point for @aurora-qa/core ────────────────────────────────────

// Orchestrator
export { Orchestrator, PipelineRunner } from './orchestrator/index.js';

// Agents
export {
  BaseAgent,
  TestGeneratorAgent,
  TestRunnerAgent,
  BugAnalyzerAgent,
  CoverageAgent,
  ReviewAgent,
  HealerAgent,
  PlaywrightAgent,
  AuroraError,
  SecurityAgent,
  PerformanceAgent,
  AccessibilityAgent,
  ChaosAgent,
  MutationTestingAgent,
  ContractTestingAgent,
} from './agents/index.js';

// Memory
export { VectorStore, KnowledgeBase, EpisodicMemory, PatternLibrary, WorkingMemory } from './memory/index.js';
export type { VectorStoreOptions, KnowledgeBaseOptions } from './memory/index.js';

// Chaos
export { ChaosEngine } from './chaos/index.js';

// Intelligence
export { TestPrioritizer } from './intelligence/test-prioritizer.js';

// Reasoning
export { ReasoningEngine } from './reasoning/index.js';

// Events
export { EventStream } from './events/stream.js';

// Metrics
export { MetricsCollector } from './metrics/index.js';

// Adapters
export { BaseAdapter } from './adapters/base-adapter.js';
export { GitHubActionsAdapter } from './adapters/github-actions.js';
export { GitLabCIAdapter } from './adapters/gitlab-ci.js';
export { JenkinsAdapter } from './adapters/jenkins.js';

// Templates
export { createFullStackWebPipeline } from './templates/full-stack-web.js';
export { createApiOnlyPipeline } from './templates/api-only.js';
export { createQuickCheckPipeline } from './templates/quick-check.js';
export { createSecurityAuditPipeline } from './templates/security-audit.js';

// Config
export { loadConfig, defaultConfig } from './config.js';
export type { Config } from './config.js';

// Types
export type {
  AgentRole,
  AgentStatus,
  AgentInfo,
  AgentEvent,
  TestCase,
  TestResult,
  TestSuite,
  TestSummary,
  TestFramework,
  TestStatus,
  GenerateTestsInput,
  GenerateTestsOutput,
  RunTestsInput,
  RunTestsOutput,
  BugReport,
  BugSeverity,
  BugCategory,
  BugStatus,
  AnalyzeBugsInput,
  AnalyzeBugsOutput,
  FileCoverage,
  CoverageReport,
  CoverageGap,
  CoverageThresholds,
  OverallCoverage,
  AnalyzeCoverageInput,
  AnalyzeCoverageOutput,
  CodeReview,
  ReviewIssue,
  IssueSeverity,
  IssueCategory,
  ReviewCodeInput,
  ReviewCodeOutput,
  PipelineConfig,
  PipelineStep,
  PipelineRun,
  PipelineStepRun,
  PipelineResults,
  PipelineStatus,
  PipelineTrigger,
  StepType,
  MemoryEntry,
  MemoryEntryType,
  VectorSearchResult,
  KnowledgeQuery,
  AuroraConfig,
  FailureClassification,
  HealingSuggestion,
  HealingStats,
  SecurityFinding,
  SecurityReport,
  SecuritySeverity,
  PerformanceAnalysis,
  PerformanceIssue,
  Optimization,
  BenchmarkResult,
  A11yFinding,
  A11yReport,
  A11ySeverity,
  ChaosIntensity,
  ChaosConfig,
  ChaosExperiment,
  ChaosReport,
  MutationType,
  Mutant,
  MutationReport,
  APIContract,
  ContractInteraction,
  ContractVerificationResult,
  ContractBreak,
  Episode,
  TestPattern,
  ReasoningResult,
  PrioritizedTest,
  MetricPoint,
  AuroraEvent,
  CIAdapterResult,
} from './types/index.js';

// Utils
export { Logger, logger } from './utils/logger.js';
