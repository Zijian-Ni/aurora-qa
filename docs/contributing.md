# Contributing to Aurora QA

Thank you for your interest in contributing to Aurora QA. This guide covers everything you need to get started, from setting up your development environment to submitting your first pull request.

## Prerequisites

- **Node.js** 20.0.0 or later
- **pnpm** 9.0.0 or later
- **Git** 2.30 or later
- **Anthropic API key** (for running agent tests)

## Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/<your-username>/aurora-qa.git
cd aurora-qa
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build All Packages

```bash
pnpm build
```

### 4. Verify Your Setup

```bash
pnpm typecheck
pnpm test
```

If all checks pass, you are ready to develop.

### 5. Environment Variables

Copy the example environment file and fill in your API key:

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

## Monorepo Structure

```
aurora-qa/
├── packages/
│   ├── core/           # @aurora-qa/core — agents, orchestrator, memory, chaos
│   ├── mcp-server/     # @aurora-qa/mcp-server — MCP server
│   └── dashboard/      # @aurora-qa/dashboard — Next.js monitoring UI
├── examples/           # Runnable example scripts
├── docs/               # Documentation
└── ...config files
```

### Working with Packages

```bash
# Build a specific package
pnpm --filter @aurora-qa/core build

# Run tests in a specific package
pnpm --filter @aurora-qa/core test

# Run the dashboard in dev mode
pnpm --filter @aurora-qa/dashboard dev

# Add a dependency to a package
pnpm --filter @aurora-qa/core add zod
```

## Development Workflow

### 1. Create a Branch

Use conventional branch naming:

```bash
git checkout -b feat/my-new-feature    # New feature
git checkout -b fix/bug-description    # Bug fix
git checkout -b docs/update-guides     # Documentation
git checkout -b refactor/module-name   # Refactoring
```

### 2. Make Changes

- Write your code following the style guide below.
- Add or update tests for any changed behavior.
- Update documentation if you change public APIs.

### 3. Run Checks Locally

```bash
pnpm build        # Ensure everything compiles
pnpm typecheck    # TypeScript type checking
pnpm test         # Run test suites
pnpm lint         # Linting
pnpm format       # Auto-format with Prettier
```

### 4. Commit

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add retry logic to TestRunnerAgent"
git commit -m "fix: handle null response in BugAnalyzer"
git commit -m "docs: update MCP integration guide"
git commit -m "refactor: extract shared scoring logic"
git commit -m "test: add unit tests for ChaosEngine"
```

### 5. Push and Open a PR

```bash
git push origin feat/my-new-feature
```

Open a pull request against `main` on GitHub. Fill in the PR template with a summary, test plan, and any breaking changes.

## Code Style

### TypeScript Guidelines

- **Strict mode**: all packages use `strict: true` in `tsconfig.json`.
- **Explicit types**: use explicit return types on public methods. Inferred types are fine for internal code.
- **Imports**: use `.js` extensions in import paths (required for ESM).
- **No `any`**: avoid `any`. Use `unknown` with type narrowing instead.
- **Readonly**: prefer `readonly` properties where possible.
- **Naming**:
  - Classes: `PascalCase`
  - Functions and methods: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.ts`
  - Types and interfaces: `PascalCase`

### Formatting

The project uses Prettier with the following configuration:

- Print width: 100
- Single quotes
- Trailing commas: `all`
- Tab width: 2 (spaces)

Run `pnpm format` to auto-format all files.

### Linting

ESLint is configured per-package. Run `pnpm lint` to check for issues.

## Testing

### Test Structure

Tests live alongside source files or in a `__tests__` directory:

```
src/
├── agents/
│   ├── bug-analyzer.ts
│   └── __tests__/
│       └── bug-analyzer.test.ts
```

### Writing Tests

- Use `vitest` as the test runner.
- Mock the Anthropic API client in unit tests — do not make real API calls.
- Use descriptive test names: `it('should classify selector failures with high confidence')`.
- Test both success and error paths.

### Running Tests

```bash
# All tests
pnpm test

# Single package
pnpm --filter @aurora-qa/core test

# Watch mode
pnpm --filter @aurora-qa/core test -- --watch

# Coverage
pnpm --filter @aurora-qa/core test -- --coverage
```

## Agent Development Guide

Adding a new agent to Aurora QA involves four steps.

### Step 1: Define the Agent Class

Create a new file in `packages/core/src/agents/`:

```typescript
// packages/core/src/agents/my-agent.ts
import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type { AuroraConfig } from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'my_tool',
    description: 'Does something specific',
    input_schema: {
      type: 'object' as const,
      properties: {
        input: { type: 'string', description: 'The input data' },
      },
      required: ['input'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's My Agent — you specialize in...`;

export class MyAgent extends BaseAgent {
  constructor(config: AuroraConfig) {
    super({
      role: 'my-agent',
      name: 'MyAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async analyze(input: { data: string }): Promise<string> {
    return this.runLoop(`Analyze this: ${input.data}`);
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'my_tool':
        // Process the tool call
        return { success: true, result: input };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
```

### Step 2: Export from the Agents Index

Add your agent to `packages/core/src/agents/index.ts`:

```typescript
export { MyAgent } from './my-agent.js';
```

### Step 3: Add Types

Define input/output types in `packages/core/src/types/index.ts`:

```typescript
export interface MyAgentInput {
  data: string;
}

export interface MyAgentOutput {
  result: string;
  score: number;
}
```

### Step 4: Add an MCP Tool (Optional)

If the agent should be accessible via MCP, add a tool handler in `packages/mcp-server/src/server.ts`:

```typescript
server.tool('my_analysis', 'Description of the tool', schema, async (params) => {
  const result = await orchestrator.myAgent.analyze(params);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

### Step 5: Write Tests

Create `packages/core/src/agents/__tests__/my-agent.test.ts` with unit tests covering:

- Normal operation with mocked API responses
- Error handling for invalid inputs
- Tool call dispatch logic
- Edge cases

## Pull Request Process

1. Ensure all CI checks pass (build, typecheck, test, lint).
2. Fill in the PR template completely.
3. Request review from at least one maintainer.
4. Address review feedback with new commits (do not force-push).
5. Once approved, a maintainer will merge your PR.

### PR Checklist

- [ ] Branch is up to date with `main`
- [ ] All existing tests pass
- [ ] New tests added for changed behavior
- [ ] TypeScript compiles without errors
- [ ] Documentation updated if public API changed
- [ ] Commit messages follow Conventional Commits
- [ ] PR description explains the "why"

## Getting Help

- Open a [Discussion](https://github.com/nicони/aurora-qa/discussions) for questions.
- Open an [Issue](https://github.com/nicони/aurora-qa/issues) for bugs or feature requests.
- Use the `agent_proposal` issue template to propose a new agent.
