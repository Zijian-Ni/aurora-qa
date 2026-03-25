# Changelog

## [1.1.0] — 2026-03-25

### New Agents
- **HealerAgent** — Self-healing test recovery with failure classification and automated fixes
- **PlaywrightAgent** — AI-powered browser automation with semantic element targeting
- **SecurityAgent** — OWASP-aligned security scanning (SQL injection, XSS, secrets, auth)
- **PerformanceAgent** — Code performance analysis (Big O, N+1 queries, memory leaks)
- **AccessibilityAgent** — WCAG 2.1 AA compliance checking for HTML and React
- **ChaosAgent** — Chaos engineering with AI-designed resilience experiments
- **MutationTestingAgent** — Mutation testing to measure test quality
- **ContractTestingAgent** — Pact-inspired API contract verification

### New Systems
- **EpisodicMemory** — Time-decay weighted episode recall
- **PatternLibrary** — Learned test pattern matching with success tracking
- **WorkingMemory** — Short-term context for pipeline runs
- **ReasoningEngine** — Chain-of-thought reasoning for complex decisions
- **TestPrioritizer** — Smart test ordering based on change proximity and history
- **MetricsCollector** — Prometheus-compatible metrics (counters, gauges, histograms)
- **EventStream** — SSE-compatible real-time event broadcasting

### New MCP Tools (6 new, 12 total)
- `scan_security` — Security vulnerability scanning
- `check_dependencies` — Dependency vulnerability checking
- `design_chaos_experiment` — AI chaos experiment design
- `check_accessibility` — WCAG compliance checking
- `analyze_performance` — Performance issue detection
- `run_mutation_testing` — Mutation testing for test quality

### Dashboard
- Complete rewrite with Next.js 15 App Router
- Real-time SSE updates for agent status
- Dark theme with glass-card design
- Pages: Dashboard, Runs, Run Detail, Agents, Bugs

### Pipeline
- Pipeline templates: Full Stack Web, API Only, Quick Check, Security Audit
- CI/CD adapters: GitHub Actions, GitLab CI, Jenkins (JUnit XML)

### Examples
- `basic-pipeline` — Full QA pipeline on utility functions
- `security-scan` — Security scanning on vulnerable code
- `chaos-resilience` — Chaos engineering experiments

### Tests
- 6 test suites, 43 tests across core modules
- VectorStore, EpisodicMemory, PatternLibrary, Logger, ChaosEngine, TestPrioritizer

### Documentation
- Complete architecture documentation
- Agent API reference
- MCP integration guide
- Chaos engineering guide
- Self-healing system guide
- Contributing guide

## [1.0.0] — 2026-03-24

### Initial Release
- 5 core agents: TestGenerator, TestRunner, BugAnalyzer, CoverageAgent, ReviewAgent
- Orchestrator with pipeline execution (topological sort, dependencies, timeouts)
- VectorStore with TF-IDF similarity search
- KnowledgeBase for learning from analysis sessions
- Express dashboard with WebSocket real-time updates
- MCP server with 6 tools
- Turbo monorepo with pnpm workspaces
