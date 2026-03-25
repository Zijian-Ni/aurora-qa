# Architecture

This document provides a deep dive into the Aurora QA system design, covering the monorepo structure, agent patterns, pipeline execution, memory layer, and event streaming.

## Monorepo Structure

Aurora QA is organized as a pnpm workspace managed by Turborepo. The monorepo contains three packages:

```
aurora-qa/
├── packages/
│   ├── core/               # @aurora-qa/core — agents, orchestrator, memory, chaos engine
│   ├── mcp-server/         # @aurora-qa/mcp-server — Model Context Protocol server
│   └── dashboard/          # @aurora-qa/dashboard — Next.js 15 real-time monitoring UI
├── examples/               # Runnable example scripts
├── docs/                   # Documentation
├── pnpm-workspace.yaml     # Workspace definition
├── turbo.json              # Turborepo pipeline config
└── tsconfig.json           # Root TypeScript config
```

### Package Dependency Graph

```
@aurora-qa/mcp-server ──▶ @aurora-qa/core
@aurora-qa/dashboard  ──▶ (standalone, consumes core via REST/SSE)
```

The `core` package has zero internal workspace dependencies. Both `mcp-server` and `dashboard` depend on `core` (mcp-server directly, dashboard via network API).

### Build System

Turborepo handles task orchestration with the following pipeline:

| Task        | Dependencies       | Cache |
|-------------|--------------------|-------|
| `build`     | `^build`           | Yes   |
| `typecheck` | `^build`           | Yes   |
| `test`      | `^build`           | Yes   |
| `lint`      | —                  | Yes   |
| `dev`       | `^build`           | No    |
| `clean`     | —                  | No    |

## Agent Base Class Pattern

Every Aurora QA agent extends `BaseAgent`, an abstract class that provides the agentic loop, event emission, and lifecycle management.

### BaseAgent Design

```typescript
abstract class BaseAgent extends EventEmitter {
  readonly id: string;          // crypto.randomUUID()
  readonly role: AgentRole;     // e.g., 'test-generator', 'bug-analyzer'
  readonly name: string;        // Human-readable name

  protected status: AgentStatus;          // 'idle' | 'running' | 'completed' | 'error'
  protected client: Anthropic;            // Anthropic SDK client
  protected systemPrompt: string;         // Agent's system instructions
  protected tools: Anthropic.Tool[];      // Available tool definitions
  protected history: Anthropic.MessageParam[];  // Conversation history

  // Subclasses must implement tool dispatch
  protected abstract handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}
```

Key design decisions:

- **EventEmitter inheritance**: agents emit `llm-response`, `tool-call`, `status-change`, and `error` events, enabling the orchestrator and dashboard to observe agent activity without tight coupling.
- **UUID identity**: each agent instance gets a unique ID, allowing multiple instances of the same agent type to coexist in a pipeline.
- **Tool definitions as data**: tools are declared as `Anthropic.Tool[]` arrays in each subclass, keeping them co-located with the handling logic.
- **History management**: conversation history is stored per agent and can be cleared between runs or preserved for multi-turn workflows.

## Agentic Loop

The core execution model is an agentic loop implemented in `BaseAgent.runLoop()`. This is the engine that powers every agent in the system.

### Flow

```
┌─────────────────────────────────────────────┐
│                  runLoop()                   │
│                                              │
│  1. Push user message to history             │
│  2. Set status to 'running'                  │
│                                              │
│  ┌─── Loop (max N iterations) ───────────┐  │
│  │                                        │  │
│  │  Call Anthropic Messages API            │  │
│  │         │                              │  │
│  │         ▼                              │  │
│  │  stop_reason === 'end_turn'?           │  │
│  │    ├── YES → extract text, break       │  │
│  │    └── NO                              │  │
│  │         │                              │  │
│  │         ▼                              │  │
│  │  stop_reason === 'tool_use'?           │  │
│  │    ├── YES → processToolUse()          │  │
│  │    │         push results to history   │  │
│  │    │         continue loop             │  │
│  │    └── NO → warn, break               │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  3. Set status to 'completed'                │
│  4. Return final text                        │
└─────────────────────────────────────────────┘
```

### Tool Processing

When Claude responds with `stop_reason: 'tool_use'`, the loop:

1. Extracts all `ToolUseBlock` entries from the response content.
2. Iterates over each tool call sequentially, dispatching to `handleToolCall()`.
3. Wraps each result in a `ToolResultBlockParam`, marking errors with `is_error: true`.
4. Pushes the tool results back into the conversation history as a `user` message.
5. Continues the loop for the next API call.

### Configuration

| Parameter       | Default | Description                          |
|-----------------|---------|--------------------------------------|
| `maxIterations` | 12      | Maximum loop iterations before halt  |
| `appendHistory` | false   | Preserve history across runs         |
| `model`         | `claude-opus-4-6` | Anthropic model identifier           |
| `maxTokens`     | 8192    | Max tokens per API response          |
| `temperature`   | 0.2     | Sampling temperature                 |

## Vector Store (TF-IDF)

Aurora QA uses a custom TF-IDF vector store for semantic similarity search, avoiding external API dependencies for embedding generation.

### TFIDFVectorizer

The vectorizer operates in three phases:

1. **Tokenization**: text is lowercased, non-alphanumeric characters are replaced with spaces, tokens shorter than 3 characters are filtered, and optional character n-grams are generated for longer tokens.

2. **Fitting**: the vectorizer scans all documents to build a vocabulary and compute inverse document frequency (IDF) weights. Tokens appearing in fewer than 2 documents (for corpora > 50 docs) are excluded to reduce noise.

3. **Transformation**: each document is converted to a sparse TF-IDF vector over the shared vocabulary. Term frequency is normalized by document length.

### Similarity Search

Similarity is computed using cosine similarity between TF-IDF vectors:

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Results are filtered by a configurable similarity threshold (default: 0.72) and returned sorted by descending score.

### KnowledgeBase

The `KnowledgeBase` class wraps `VectorStore` with domain-specific helpers:

- `ingestBugReport(report)` — stores bug analysis results with relevant tags
- `ingestTestResults(results)` — stores test outcomes for pattern learning
- `ingestReview(review)` — stores code review findings
- `learnFact(type, content, metadata, tags)` — general-purpose knowledge ingestion
- `query(query)` — semantic search with optional type and tag filters

### Persistence

The vector store supports optional file-system persistence via `persistPath`. On initialization, it loads previously stored entries from a JSON file. On each write, it flushes the updated store back to disk.

## Pipeline Topological Execution

The `PipelineRunner` executes a directed acyclic graph (DAG) of pipeline steps, resolving dependencies via topological sort.

### Pipeline Configuration

A pipeline is defined as a `PipelineConfig`:

```typescript
interface PipelineConfig {
  id: string;
  name: string;
  steps: PipelineStep[];
}

interface PipelineStep {
  id: string;
  type: StepType;       // 'generate-tests' | 'run-tests' | 'analyze-bugs' | ...
  dependsOn?: string[]; // IDs of predecessor steps
  config?: Record<string, unknown>;
}
```

### Execution Algorithm

1. **Validation**: verify the step graph is a valid DAG (no cycles).
2. **Topological sort**: compute execution order using Kahn's algorithm.
3. **Level partitioning**: group steps into levels where all steps in a level have their dependencies satisfied. Steps within the same level can run concurrently.
4. **Execution**: for each level, dispatch all steps in parallel using `Promise.all()`. Each step is routed to the appropriate agent based on its `type`.
5. **Result propagation**: step outputs are stored in a `Map<string, unknown>` keyed by step ID. Dependent steps receive their predecessors' outputs via this map.

### Step Types

| Step Type          | Agent               | Input                   |
|--------------------|----------------------|-------------------------|
| `generate-tests`   | TestGeneratorAgent   | `GenerateTestsInput`    |
| `run-tests`        | TestRunnerAgent      | `RunTestsInput`         |
| `analyze-bugs`     | BugAnalyzerAgent     | `AnalyzeBugsInput`      |
| `analyze-coverage` | CoverageAgent        | `AnalyzeCoverageInput`  |
| `review-code`      | ReviewAgent          | `ReviewCodeInput`       |

### Error Handling

If a step fails:

- The step is marked with `status: 'failed'` and the error is recorded.
- Dependent steps are skipped and marked as `status: 'skipped'`.
- Independent steps in the same level continue to execute.
- The overall pipeline status is set to `'failed'`.

## Event Streaming

Aurora QA uses Server-Sent Events (SSE) to stream real-time updates from the core engine to the dashboard.

### EventStream

The `EventStream` class provides a pub/sub layer over Node.js `EventEmitter`:

```typescript
class EventStream extends EventEmitter {
  publish(event: AuroraEvent): void;
  subscribe(handler: (event: AuroraEvent) => void): () => void;
  createSSEStream(): ReadableStream;
}
```

### Event Types

| Event                | Payload                                    |
|----------------------|--------------------------------------------|
| `pipeline:started`   | `{ runId, pipelineName, trigger }`         |
| `pipeline:completed` | `{ runId, status, duration, results }`     |
| `step:started`       | `{ runId, stepId, stepType }`              |
| `step:completed`     | `{ runId, stepId, status, output }`        |
| `agent:status`       | `{ agentId, from, to }`                    |
| `agent:tool-call`    | `{ agentId, tool, input }`                 |
| `knowledge:ingested` | `{ type, entryCount }`                     |

### SSE Transport

The dashboard connects to the core API via an SSE endpoint (`GET /api/events`). The `EventStream.createSSEStream()` method returns a `ReadableStream` that formats events as SSE frames:

```
event: pipeline:started
data: {"runId":"abc-123","pipelineName":"full-qa","trigger":"manual"}

event: agent:status
data: {"agentId":"def-456","from":"idle","to":"running"}
```

### Dashboard Integration

The Next.js dashboard uses `EventSource` on the client side to receive events. Each event type maps to a specific UI update:

- Pipeline events update the run list and status indicators.
- Agent status events update the agent grid with live status badges.
- Step events update progress bars within a pipeline run detail view.

## Configuration System

Configuration is managed through Zod schemas in `packages/core/src/config.ts`. The `loadConfig()` function merges environment variables with programmatic overrides:

```typescript
const config = loadConfig({
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
});
```

All configuration fields have sensible defaults, and environment variables take precedence for deployment flexibility. See the `.env.example` file for a complete list of options.
