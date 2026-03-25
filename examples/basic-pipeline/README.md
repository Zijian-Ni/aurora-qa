# Basic Pipeline Example

Demonstrates running a full Aurora QA pipeline on sample utility functions.

## Setup

```bash
cd /path/to/aurora-qa
pnpm install && pnpm build
```

## Run

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-pipeline/index.ts
```

## What it does

1. Reads `sample-code.ts` (utility functions: add, divide, formatDate, isPalindrome, debounce)
2. Runs the Full Stack Web pipeline: Generate Tests → Run Tests → Coverage → Bug Analysis → Code Review
3. Prints results summary
