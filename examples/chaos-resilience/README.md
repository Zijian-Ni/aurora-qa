# Chaos Resilience Example

Demonstrates Aurora QA's chaos engineering capabilities.

## Run

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/chaos-resilience/index.ts
```

## What it does

1. Creates a simple target service with various endpoints
2. Runs baseline performance measurement
3. Injects chaos: network latency, time skew
4. Uses AI to design custom chaos experiments
5. Reports resilience metrics
