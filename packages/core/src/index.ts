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
} from './agents/index.js';

// Memory
export { VectorStore, KnowledgeBase } from './memory/index.js';
export type { VectorStoreOptions, KnowledgeBaseOptions } from './memory/index.js';

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
} from './types/index.js';

// Utils
export { Logger, logger } from './utils/logger.js';
