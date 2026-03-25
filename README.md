# Aurora QA 🤖

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-9.14-orange?logo=pnpm)](https://pnpm.io)
[![Node 20+](https://img.shields.io/badge/Node-20%2B-green?logo=node.js)](https://nodejs.org)

> AI-powered autonomous quality engineering platform — 13 specialized agents, chaos engineering, self-healing tests, MCP server & real-time dashboard

Aurora QA is an intelligent quality engineering platform that uses Claude to autonomously generate tests, find bugs, analyze code security, measure performance, and ensure accessibility. It features 13 specialized AI agents orchestrated through a pipeline system, backed by a vector-based knowledge memory that learns from every analysis.

The platform integrates with your development workflow via the Model Context Protocol (MCP), CI/CD adapters for GitHub Actions, GitLab CI, and Jenkins, and a real-time Next.js dashboard for monitoring.

## ✨ Features

- 🧪 **AI Test Generation** — Generates comprehensive test suites covering edge cases, error paths, and happy paths
- 🐛 **Intelligent Bug Detection** — Deep static analysis with AI-powered reasoning for complex bugs
- 🔒 **OWASP Security Scanning** — SQL injection, XSS, secrets detection, auth analysis
- ⚡ **Performance Analysis** — Big O estimation, N+1 queries, memory leak detection
- ♿ **Accessibility Checking** — WCAG 2.1 AA compliance analysis for HTML and React
- 🔥 **Chaos Engineering** — Network latency/failure injection, CPU stress, memory pressure, time skew
- 🧬 **Mutation Testing** — Measures test quality by generating code mutations
- 📋 **Contract Testing** — Pact-inspired API contract verification
- 🩹 **Self-Healing Tests** — Automatically classifies and fixes flaky tests
- 🎭 **Browser Automation** — AI-powered semantic element targeting with Playwright
- 🧠 **Knowledge Memory** — TF-IDF vector store learns from every analysis session
- 📊 **Real-time Dashboard** — Next.js 15 dashboard with SSE live updates
- 🔌 **MCP Integration** — 12 tools available in Claude Desktop, Cursor, VS Code

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Aurora QA Platform                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────── Orchestrator ────────────────────────┐  │
│  │                                                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐  │  │
│  │  │ TestGen     │ │ TestRunner  │ │ BugAnalyzer      │  │  │
│  │  │ Agent       │ │ Agent       │ │ Agent            │  │  │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐  │  │
│  │  │ Coverage    │ │ Review      │ │ Healer           │  │  │
│  │  │ Agent       │ │ Agent       │ │ Agent            │  │  │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐  │  │
│  │  │ Security    │ │ Performance │ │ Accessibility    │  │  │
│  │  │ Agent       │ │ Agent       │ │ Agent            │  │  │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐  │  │
│  │  │ Chaos       │ │ Mutation    │ │ Contract         │  │  │
│  │  │ Agent       │ │ Agent       │ │ Agent            │  │  │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘  │  │
│  │  ┌─────────────┐                                        │  │
│  │  │ Playwright  │    Pipeline Runner                     │  │
│  │  │ Agent       │    (topological execution)             │  │
│  │  └─────────────┘                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─── Memory Layer ───┐  ┌── Intelligence ──┐  ┌── Events ──┐│
│  │ VectorStore (TF-IDF│  │ ReasoningEngine  │  │ EventStream││
│  │ KnowledgeBase      │  │ TestPrioritizer  │  │ (SSE)      ││
│  │ EpisodicMemory     │  └──────────────────┘  └────────────┘│
│  │ PatternLibrary     │  ┌── Metrics ────────┐               │
│  │ WorkingMemory      │  │ MetricsCollector  │               │
│  └────────────────────┘  │ (Prometheus fmt)  │               │
│                           └──────────────────┘               │
├──────────────────────────────────────────────────────────────┤
│  MCP Server (12 tools)  │  Dashboard (Next.js 15)  │  CI/CD │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/nicони/aurora-qa.git && cd aurora-qa

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# 5. Run an example
npx tsx examples/basic-pipeline/index.ts
```

## 🤖 Agents (13 total)

| Agent | Role | Key Capabilities |
|-------|------|-----------------|
| **TestGenerator** | Test creation | Generates comprehensive test suites with edge cases |
| **TestRunner** | Test execution | Runs tests, parses output with AI |
| **BugAnalyzer** | Bug detection | Deep static analysis, severity ratings |
| **CoverageAgent** | Coverage analysis | Gap detection, threshold checking |
| **ReviewAgent** | Code review | Quality scoring, issue categorization |
| **HealerAgent** | Self-healing | Classifies failures, suggests automated fixes |
| **PlaywrightAgent** | Browser automation | AI-powered semantic element targeting |
| **SecurityAgent** | Security scanning | OWASP-aligned vulnerability detection |
| **PerformanceAgent** | Performance analysis | Big O, N+1 queries, memory leaks |
| **AccessibilityAgent** | a11y checking | WCAG 2.1 AA compliance |
| **ChaosAgent** | Chaos engineering | Resilience testing with fault injection |
| **MutationAgent** | Mutation testing | Measures test quality via code mutations |
| **ContractAgent** | Contract testing | API contract verification (Pact-inspired) |

## 🔌 MCP Tools (12 tools)

| Tool | Description |
|------|-------------|
| `generate_tests` | Generate comprehensive test cases for source code |
| `run_tests` | Execute tests and return structured results |
| `analyze_bugs` | Deep static analysis for bugs and vulnerabilities |
| `review_code` | Thorough code review with scoring |
| `analyze_coverage` | Coverage gap analysis |
| `query_knowledge` | Search the knowledge base for patterns |
| `scan_security` | OWASP security scanning |
| `check_dependencies` | Vulnerable dependency detection |
| `design_chaos_experiment` | Design chaos engineering scenarios |
| `check_accessibility` | WCAG compliance checking |
| `analyze_performance` | Performance issue detection |
| `run_mutation_testing` | Mutation testing for test quality |

## 📊 Dashboard

The Next.js 15 dashboard provides real-time monitoring:

```
┌──────────────────────────────────────────────┐
│  Aurora QA                        ● Live     │
├──────────┬───────────────────────────────────┤
│          │  [Runs: 142] [Pass: 94.2%]       │
│  ◈ Dash  │  [Bugs: 23]  [Avg: 4.2s]        │
│  ▶ Runs  │                                   │
│  ⚙ Agent │  Agent Status (13 agents)         │
│  🪲 Bugs │  Recent Pipeline Runs             │
│          │  Bug Tracker with Severity         │
└──────────┴───────────────────────────────────┘
```

```bash
pnpm dashboard  # http://localhost:3001
```

## 🔥 Chaos Engineering

Aurora QA includes a full chaos engineering engine:

- **Network Latency** — Inject artificial delays into fetch calls
- **Network Failure** — Randomly fail network requests
- **CPU Stress** — Block the event loop to simulate load
- **Memory Pressure** — Allocate memory to test GC behavior
- **Random Errors** — Inject errors at configurable probability
- **Time Skew** — Offset `Date.now()` for temporal testing

```typescript
import { ChaosEngine } from '@aurora-qa/core';

const engine = new ChaosEngine();
engine.injectNetworkLatency(200, 0.5);  // 200ms delay, 50% probability
engine.injectNetworkFailure(0.1);       // 10% failure rate
// ... run your tests ...
engine.reset();
```

## 🧠 Intelligence Layer

- **EpisodicMemory** — Stores and recalls past analysis sessions with time-decay scoring
- **PatternLibrary** — Learns successful test patterns and matches them to new contexts
- **WorkingMemory** — Short-term context for current pipeline run
- **ReasoningEngine** — Chain-of-thought reasoning for complex decisions
- **TestPrioritizer** — Smart test ordering based on change proximity, failure history, and criticality

## ⚙️ Configuration

```bash
# Environment variables
ANTHROPIC_API_KEY=sk-ant-...   # Required
AURORA_MODEL=claude-opus-4-6          # AI model (default: claude-opus-4-6)
DASHBOARD_PORT=3001             # Dashboard port
DASHBOARD_HOST=0.0.0.0         # Dashboard host
CORS_ORIGINS=http://localhost:3000
```

## 📖 Examples

| Example | Description |
|---------|-------------|
| [`basic-pipeline`](examples/basic-pipeline/) | Full QA pipeline on utility functions |
| [`security-scan`](examples/security-scan/) | Security scanning on vulnerable code |
| [`chaos-resilience`](examples/chaos-resilience/) | Chaos engineering experiments |

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feat/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT — Built with ❤️ by Zijian Ni & Aurora Xiaoluo 🎀
