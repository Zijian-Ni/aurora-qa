# Agents Reference

Aurora QA includes 13 specialized AI agents, each extending the `BaseAgent` class. Every agent uses Claude via the Anthropic Messages API with tool use to perform its domain-specific tasks.

---

## Table of Contents

1. [TestGeneratorAgent](#testgeneratoragent)
2. [TestRunnerAgent](#testrunneragent)
3. [BugAnalyzerAgent](#buganalyzeragent)
4. [CoverageAgent](#coverageagent)
5. [ReviewAgent](#reviewagent)
6. [HealerAgent](#healeragent)
7. [PlaywrightAgent](#playwrightagent)
8. [SecurityAgent](#securityagent)
9. [PerformanceAgent](#performanceagent)
10. [AccessibilityAgent](#accessibilityagent)
11. [ChaosAgent](#chaosagent)
12. [MutationTestingAgent](#mutationtestingagent)
13. [ContractTestingAgent](#contracttestingagent)

---

## TestGeneratorAgent

**Role**: `test-generator`
**Source**: `packages/core/src/agents/test-generator.ts`

Generates comprehensive test suites for source code, covering happy paths, edge cases, error paths, and boundary conditions.

### API

```typescript
class TestGeneratorAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  generateTests(input: GenerateTestsInput): Promise<GenerateTestsOutput>;
}
```

### Input: `GenerateTestsInput`

| Field           | Type     | Required | Description                                  |
|-----------------|----------|----------|----------------------------------------------|
| `sourceCode`    | `string` | Yes      | Source code to generate tests for             |
| `language`      | `string` | No       | Programming language (auto-detected if omitted) |
| `framework`     | `string` | No       | Test framework (e.g., `jest`, `vitest`, `pytest`) |
| `style`         | `string` | No       | Test style preferences                       |
| `existingTests` | `string` | No       | Existing test code for context               |

### Output: `GenerateTestsOutput`

| Field        | Type         | Description                        |
|--------------|--------------|------------------------------------|
| `tests`      | `TestCase[]` | Array of generated test cases      |
| `summary`    | `string`     | Human-readable summary             |
| `coverage`   | `object`     | Estimated coverage breakdown       |

### Tools

| Tool Name        | Description                            |
|------------------|----------------------------------------|
| `emit_test_case` | Emit a single generated test case      |
| `emit_summary`   | Emit the generation summary            |

---

## TestRunnerAgent

**Role**: `test-runner`
**Source**: `packages/core/src/agents/test-runner.ts`

Executes test suites by spawning test runner processes, capturing output, and using AI to parse and analyze results.

### API

```typescript
class TestRunnerAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  runTests(input: RunTestsInput): Promise<RunTestsOutput>;
}
```

### Input: `RunTestsInput`

| Field       | Type     | Required | Description                          |
|-------------|----------|----------|--------------------------------------|
| `testCode`  | `string` | Yes      | Test source code to execute          |
| `sourceCode`| `string` | No       | Source code under test               |
| `command`   | `string` | No       | Custom test command                  |
| `timeout`   | `number` | No       | Execution timeout in ms (default: 30000) |

### Output: `RunTestsOutput`

| Field       | Type            | Description                     |
|-------------|-----------------|--------------------------------|
| `passed`    | `number`        | Count of passing tests          |
| `failed`    | `number`        | Count of failing tests          |
| `skipped`   | `number`        | Count of skipped tests          |
| `total`     | `number`        | Total test count                |
| `results`   | `TestResult[]`  | Individual test results         |
| `rawOutput` | `string`        | Raw stdout/stderr output        |
| `duration`  | `number`        | Execution time in ms            |

### Tools

| Tool Name      | Description                              |
|----------------|------------------------------------------|
| `execute_test` | Execute a test command in a subprocess   |
| `parse_output` | Parse test runner output into results    |

---

## BugAnalyzerAgent

**Role**: `bug-analyzer`
**Source**: `packages/core/src/agents/bug-analyzer.ts`

Performs deep static analysis of source code to detect bugs, anti-patterns, and potential vulnerabilities. Assigns severity ratings and provides fix suggestions.

### API

```typescript
class BugAnalyzerAgent extends BaseAgent {
  constructor(config: AuroraConfig, knowledgeBase?: KnowledgeBase);

  analyzeBugs(input: AnalyzeBugsInput): Promise<AnalyzeBugsOutput>;
}
```

### Input: `AnalyzeBugsInput`

| Field        | Type     | Required | Description                            |
|--------------|----------|----------|----------------------------------------|
| `sourceCode` | `string` | Yes      | Source code to analyze                 |
| `language`   | `string` | No       | Programming language                   |
| `context`    | `string` | No       | Additional context about the codebase  |

### Output: `AnalyzeBugsOutput`

| Field    | Type          | Description                         |
|----------|---------------|-------------------------------------|
| `bugs`   | `BugReport[]` | Array of detected bugs              |
| `summary`| `string`      | Analysis summary                    |
| `score`  | `number`      | Code health score (0-100)           |

### BugReport Fields

| Field        | Type     | Description                           |
|--------------|----------|---------------------------------------|
| `id`         | `string` | Unique bug identifier                 |
| `severity`   | `string` | `critical` / `high` / `medium` / `low` |
| `title`      | `string` | Short description                     |
| `description`| `string` | Detailed explanation                  |
| `location`   | `object` | File, line, and column reference      |
| `suggestion` | `string` | Recommended fix                       |

### Tools

| Tool Name    | Description                             |
|--------------|-----------------------------------------|
| `report_bug` | Report a discovered bug with metadata   |
| `emit_score` | Emit the overall code health score      |

---

## CoverageAgent

**Role**: `coverage-agent`
**Source**: `packages/core/src/agents/coverage-agent.ts`

Analyzes code coverage data, identifies untested code paths, and recommends areas where additional tests are needed.

### API

```typescript
class CoverageAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  analyzeCoverage(input: AnalyzeCoverageInput): Promise<AnalyzeCoverageOutput>;
}
```

### Input: `AnalyzeCoverageInput`

| Field          | Type     | Required | Description                          |
|----------------|----------|----------|--------------------------------------|
| `sourceCode`   | `string` | Yes      | Source code                          |
| `testCode`     | `string` | No       | Existing tests                       |
| `coverageData` | `string` | No       | Raw coverage data (lcov, istanbul)   |
| `threshold`    | `number` | No       | Target coverage percentage           |

### Output: `AnalyzeCoverageOutput`

| Field        | Type              | Description                    |
|--------------|-------------------|--------------------------------|
| `percentage` | `number`          | Overall coverage percentage    |
| `gaps`       | `CoverageGap[]`   | Identified coverage gaps       |
| `summary`    | `string`          | Coverage analysis summary      |
| `meetsThreshold` | `boolean`     | Whether threshold is met       |

### Tools

| Tool Name        | Description                              |
|------------------|------------------------------------------|
| `report_gap`     | Report a coverage gap                    |
| `emit_coverage`  | Emit overall coverage metrics            |

---

## ReviewAgent

**Role**: `review-agent`
**Source**: `packages/core/src/agents/review-agent.ts`

Conducts thorough code reviews, scoring code quality across multiple dimensions and categorizing issues by type and severity.

### API

```typescript
class ReviewAgent extends BaseAgent {
  constructor(config: AuroraConfig, knowledgeBase?: KnowledgeBase);

  reviewCode(input: ReviewCodeInput): Promise<ReviewCodeOutput>;
}
```

### Input: `ReviewCodeInput`

| Field        | Type     | Required | Description                          |
|--------------|----------|----------|--------------------------------------|
| `sourceCode` | `string` | Yes      | Code to review                       |
| `language`   | `string` | No       | Programming language                 |
| `guidelines` | `string` | No       | Project-specific coding standards    |

### Output: `ReviewCodeOutput`

| Field     | Type              | Description                       |
|-----------|-------------------|-----------------------------------|
| `issues`  | `ReviewIssue[]`   | Identified review issues          |
| `score`   | `number`          | Quality score (0-100)             |
| `summary` | `string`          | Review summary                    |
| `metrics` | `object`          | Readability, complexity, etc.     |

### Tools

| Tool Name      | Description                               |
|----------------|-------------------------------------------|
| `report_issue` | Report a code quality issue               |
| `emit_review`  | Emit review scores and summary            |

---

## HealerAgent

**Role**: `healer-agent`
**Source**: `packages/core/src/agents/healer-agent.ts`

Self-healing test recovery system. Analyzes test failures, classifies root causes, and suggests automated fixes. Learns from outcomes to improve future healing.

### API

```typescript
class HealerAgent extends BaseAgent {
  constructor(config: AuroraConfig, knowledgeBase?: KnowledgeBase);

  analyzeFailure(
    error: string,
    context: Record<string, unknown>,
    screenshot?: string,
  ): Promise<{ classification: FailureClassification; suggestion: HealingSuggestion }>;

  classifyFailure(): FailureClassification;

  suggestFix(
    classification: FailureClassification,
    context: Record<string, unknown>,
  ): Promise<HealingSuggestion>;

  applyFix(
    patch: Record<string, unknown>,
    testCase: Record<string, unknown>,
  ): { applied: boolean; result: string };

  learnFromOutcome(
    fix: HealingSuggestion,
    success: boolean,
    context: Record<string, unknown>,
  ): void;

  getHealingStats(): HealingStats;
}
```

### Failure Classifications

| Classification     | Description                                       |
|--------------------|---------------------------------------------------|
| `selector_stale`   | UI element selectors that no longer match the DOM |
| `timing_race`      | Race conditions or timing-dependent failures      |
| `env_flakiness`    | Environment-specific issues                       |
| `logic_change`     | Intentional code changes requiring test updates   |
| `data_dependency`  | Test data assumptions that are no longer valid     |
| `unknown`          | Cannot determine root cause                       |

### HealingSuggestion

| Field        | Type     | Description                           |
|--------------|----------|---------------------------------------|
| `fix`        | `string` | Description of the fix                |
| `confidence` | `number` | Confidence score (0-1)                |
| `strategy`   | `string` | Name of the healing strategy          |
| `patch`      | `object` | Optional code patch to apply          |

### Tools

| Tool Name          | Description                                  |
|--------------------|----------------------------------------------|
| `classify_failure` | Classify the root cause of a test failure    |
| `suggest_fix`      | Suggest a fix for the classified failure     |

---

## PlaywrightAgent

**Role**: `playwright-agent`
**Source**: `packages/core/src/agents/playwright-agent.ts`

AI-powered browser automation agent that uses semantic element targeting instead of brittle CSS selectors. Generates Playwright test scripts with intelligent element resolution.

### API

```typescript
class PlaywrightAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  generateTest(
    url: string,
    scenario: string,
    options?: { headless?: boolean; viewport?: { width: number; height: number } },
  ): Promise<string>;
}
```

### Features

- **Semantic targeting**: identifies elements by role, label text, and ARIA attributes rather than CSS selectors.
- **Screenshot analysis**: can analyze page screenshots to understand visual layout.
- **Resilient selectors**: generates `getByRole()`, `getByText()`, and `getByTestId()` selectors that survive UI refactors.
- **Error recovery**: the `AuroraError` class provides structured error handling for browser automation failures.

### Tools

| Tool Name           | Description                                  |
|---------------------|----------------------------------------------|
| `navigate`          | Navigate to a URL                            |
| `find_element`      | Find an element using semantic targeting     |
| `interact`          | Click, type, or interact with an element     |
| `assert`            | Make an assertion about page state           |
| `screenshot`        | Capture a screenshot for analysis            |

---

## SecurityAgent

**Role**: `security-agent`
**Source**: `packages/core/src/agents/security-agent.ts`

OWASP-aligned security scanning agent. Detects SQL injection, XSS, exposed secrets, authentication weaknesses, and other vulnerabilities.

### API

```typescript
class SecurityAgent extends BaseAgent {
  constructor(config: AuroraConfig, knowledgeBase?: KnowledgeBase);

  scanSecurity(input: {
    sourceCode: string;
    language?: string;
    context?: string;
  }): Promise<SecurityScanOutput>;

  checkDependencies(input: {
    packageJson?: string;
    lockfile?: string;
  }): Promise<DependencyScanOutput>;
}
```

### Vulnerability Categories

| Category             | Examples                                          |
|----------------------|---------------------------------------------------|
| SQL Injection        | Unsanitized query parameters, string concatenation |
| Cross-Site Scripting | Unescaped user input in HTML, `dangerouslySetInnerHTML` |
| Secrets Exposure     | Hardcoded API keys, passwords in source            |
| Auth Weaknesses      | Missing authentication checks, weak token handling |
| Insecure Dependencies| Known CVEs in npm packages                         |
| CSRF                 | Missing CSRF tokens in forms                       |
| Path Traversal       | Unsanitized file paths                             |

### Tools

| Tool Name             | Description                                |
|-----------------------|--------------------------------------------|
| `report_vulnerability`| Report a security vulnerability            |
| `check_dependency`    | Check a dependency against known CVEs      |
| `emit_security_score` | Emit overall security posture score        |

---

## PerformanceAgent

**Role**: `performance-agent`
**Source**: `packages/core/src/agents/performance-agent.ts`

Analyzes code for performance issues including algorithmic complexity, N+1 query patterns, memory leaks, and inefficient data structures.

### API

```typescript
class PerformanceAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  analyzePerformance(input: {
    sourceCode: string;
    language?: string;
    context?: string;
  }): Promise<PerformanceAnalysisOutput>;
}
```

### Detection Categories

| Category          | Description                                       |
|-------------------|---------------------------------------------------|
| Big O Complexity  | Identifies unnecessarily high time/space complexity|
| N+1 Queries       | Database queries inside loops                      |
| Memory Leaks      | Unclosed resources, growing collections, event listener leaks |
| Redundant Work    | Duplicate computations, unnecessary re-renders     |
| Data Structures   | Suboptimal collection choices (e.g., array vs. set) |
| Bundle Size       | Oversized imports, tree-shaking opportunities      |

### Tools

| Tool Name          | Description                                 |
|--------------------|---------------------------------------------|
| `report_issue`     | Report a performance issue                  |
| `estimate_bigO`    | Estimate algorithmic complexity             |
| `emit_perf_score`  | Emit overall performance score              |

---

## AccessibilityAgent

**Role**: `accessibility-agent`
**Source**: `packages/core/src/agents/accessibility-agent.ts`

Checks HTML and React components for WCAG 2.1 AA compliance, identifying accessibility issues in structure, semantics, color contrast, and keyboard navigation.

### API

```typescript
class AccessibilityAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  checkAccessibility(input: {
    sourceCode: string;
    format?: 'html' | 'react' | 'vue';
    standard?: 'WCAG21-AA' | 'WCAG21-AAA';
  }): Promise<AccessibilityOutput>;
}
```

### WCAG Categories Checked

| Principle     | Checks                                              |
|---------------|-----------------------------------------------------|
| Perceivable   | Alt text, color contrast, text resizing, captions   |
| Operable      | Keyboard access, focus management, skip links       |
| Understandable| Labels, error messages, consistent navigation       |
| Robust        | Valid HTML, ARIA attributes, semantic elements       |

### Tools

| Tool Name           | Description                                  |
|---------------------|----------------------------------------------|
| `report_a11y_issue` | Report an accessibility violation            |
| `emit_a11y_score`   | Emit WCAG compliance score                   |

---

## ChaosAgent

**Role**: `chaos-agent`
**Source**: `packages/core/src/agents/chaos-agent.ts`

AI-powered chaos engineering agent that designs fault injection experiments, predicts system behavior under stress, and scores resilience.

### API

```typescript
class ChaosAgent extends BaseAgent {
  constructor(config: AuroraConfig, chaosEngine: ChaosEngine);

  designExperiment(input: {
    sourceCode: string;
    systemDescription?: string;
    targetResilience?: number;
  }): Promise<ChaosExperimentDesign>;
}
```

### Experiment Design

The agent analyzes source code and system architecture to design targeted chaos experiments. It selects appropriate injection types, configures intensity levels, and predicts expected behavior.

See [Chaos Engineering Guide](./chaos-engineering.md) for full details.

### Tools

| Tool Name              | Description                                 |
|------------------------|---------------------------------------------|
| `design_experiment`    | Design a chaos engineering experiment       |
| `inject_fault`         | Configure a specific fault injection        |
| `predict_behavior`     | Predict system behavior under injection     |
| `score_resilience`     | Score system resilience                     |

---

## MutationTestingAgent

**Role**: `mutation-agent`
**Source**: `packages/core/src/agents/mutation-agent.ts`

Measures test suite quality by generating code mutations and checking whether existing tests catch them. A killed mutation means tests are effective; a surviving mutation indicates a gap.

### API

```typescript
class MutationTestingAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  runMutationTesting(input: {
    sourceCode: string;
    testCode: string;
    language?: string;
  }): Promise<MutationTestingOutput>;
}
```

### Output: `MutationTestingOutput`

| Field             | Type         | Description                           |
|-------------------|--------------|---------------------------------------|
| `mutants`         | `Mutant[]`   | All generated mutants                 |
| `killed`          | `number`     | Mutants caught by tests               |
| `survived`        | `number`     | Mutants not caught by tests           |
| `score`           | `number`     | Mutation score (killed / total)       |
| `summary`         | `string`     | Analysis summary                      |
| `recommendations` | `string[]`   | Suggestions for improving test quality|

### Mutation Operators

| Operator                  | Example                              |
|---------------------------|--------------------------------------|
| Arithmetic replacement    | `a + b` becomes `a - b`             |
| Conditional boundary      | `x > 0` becomes `x >= 0`            |
| Negation                  | `if (valid)` becomes `if (!valid)`   |
| Return value mutation     | `return x` becomes `return null`     |
| Remove method call        | `list.sort()` becomes `list`         |
| String mutation           | `"hello"` becomes `""`              |

### Tools

| Tool Name         | Description                                  |
|-------------------|----------------------------------------------|
| `generate_mutant` | Generate a code mutant                       |
| `evaluate_mutant` | Check if a mutant is killed by tests         |
| `emit_score`      | Emit mutation testing score                  |

---

## ContractTestingAgent

**Role**: `contract-agent`
**Source**: `packages/core/src/agents/contract-agent.ts`

Pact-inspired API contract testing. Verifies that API consumers and providers agree on request/response schemas, detecting breaking changes before deployment.

### API

```typescript
class ContractTestingAgent extends BaseAgent {
  constructor(config: AuroraConfig);

  verifyContract(input: {
    consumerCode: string;
    providerCode: string;
    existingContract?: string;
    apiSpec?: string;
  }): Promise<ContractTestingOutput>;
}
```

### Output: `ContractTestingOutput`

| Field          | Type                | Description                         |
|----------------|---------------------|-------------------------------------|
| `compatible`   | `boolean`           | Whether consumer and provider agree |
| `violations`   | `ContractViolation[]` | Detected contract violations      |
| `contract`     | `object`            | Inferred or validated contract      |
| `summary`      | `string`            | Human-readable summary              |

### Contract Violation Types

| Type               | Description                                    |
|--------------------|------------------------------------------------|
| `missing_field`    | Consumer expects a field the provider omits    |
| `type_mismatch`    | Field type differs between consumer and provider |
| `status_change`    | HTTP status code changed                       |
| `schema_breaking`  | Structural schema incompatibility              |
| `enum_drift`       | Enum values differ between sides               |

### Tools

| Tool Name           | Description                                  |
|---------------------|----------------------------------------------|
| `extract_contract`  | Extract API contract from consumer/provider  |
| `verify_field`      | Verify a specific contract field             |
| `report_violation`  | Report a contract violation                  |
| `emit_result`       | Emit contract verification result            |
