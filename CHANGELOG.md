# Changelog

All notable changes to Aurora QA are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-03-26

### Fixed
- Set `ANTHROPIC_API_KEY` placeholder in test script so `pnpm run test` passes in CI without real credentials

---

## [1.2.0] - 2026-03-26

### Added
- **Circuit Breaker**: `BaseAgent` now tracks consecutive failures and auto-halts after 3 (configurable via `maxConsecutiveFailures`), emitting a `circuit-breaker` event; `resetCircuitBreaker()` re-enables the agent
- **Unit Tests**: 65 tests across 9 suites covering config validation, metrics, vector-store, event stream, chaos engine, episodic memory, pattern library, test prioritizer, and logger
- **Advanced Agent Integration**: `SecurityAgent`, `PerformanceAgent`, and `HealerAgent` wired into `Pipeline` and `Orchestrator` with new step types and direct APIs
- **ReasoningEngine Timeout**: `AbortController` + configurable timeout (default 30s); graceful degradation returns `confidence: 0` on timeout instead of hanging indefinitely

### Changed
- **ChaosEngine**: Refactored from global state mutation to instance-level interceptors — multiple `ChaosEngine` instances no longer share/pollute each other's fault context
- **README**: Updated with circuit breaker & timeout API usage examples and accurate feature documentation

### Fixed
- `KnowledgeBase`: All 5 `learn*` methods wrapped with `try-catch` + error logging to prevent silent failures

---

## [1.1.0] - 2026-03-26

### Added
- `IssueCategory` enum extended with `'error-handling'` and `'edge-cases'` values
- `GenerateTestsInput` gains optional `context` field
- `GenerateTestsOutput` gains index signature for `Record<string, unknown>` compatibility
- Independent `tsconfig.json` and `package.json` for all 4 example packages

### Changed
- `BaseAgent`: Added `maxHistorySize` limit (default 1000) with automatic `trimHistory()` to prevent unbounded memory growth
- `config.ts`: Added API key non-empty validation, `maxTokens` positive-integer check, dashboard port range check (1–65535)
- `tsconfig.json`: Restructured as monorepo base config, excluding sub-packages to prevent duplicate compilation

### Fixed
- `pipeline.ts`: `clearTimeout` now called on step completion/error — prevents timeout handle leak and unhandled Promise rejections
- `vector-store.ts`: `l2normalize` guards against near-zero norm (`norm < 1e-10`) to prevent `NaN` propagation
- `metrics/index.ts`: Percentile calculation corrected (`Math.ceil - 1`); histogram label concatenation fixed
- `events/stream.ts`: Race condition in `toAsyncIterator` resolve callback eliminated
- `test-prioritizer.ts`: Division-by-zero guard in `predictFlakiness`; removed unsafe `pop()!` non-null assertion
- `reasoning/index.ts`: JSON parse failures now logged instead of silently swallowed
- `dashboard/api/runs/route.ts`: `body` typed as `unknown` with explicit cast
- 130+ TypeScript compilation errors resolved across all packages and examples

---

## [1.0.0] - 2026-03-25

### Added
- Initial release of Aurora QA — AI-powered quality assurance platform
- `@aurora-qa/core`: Core QA engine with agents, orchestrator, reasoning, memory, metrics, chaos, intelligence modules
- `@aurora-qa/dashboard`: Next.js dashboard for visualising runs, bugs, and agent status
- `@aurora-qa/mcp-server`: MCP server exposing QA tools to compatible AI clients
- Example pipelines: basic pipeline, security scan, chaos resilience, philiapedia integration test
- Turborepo monorepo setup with pnpm workspaces
