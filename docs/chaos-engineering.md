# Chaos Engineering Guide

Aurora QA includes a built-in chaos engineering framework consisting of the `ChaosEngine` (a programmable fault injection runtime) and the `ChaosAgent` (an AI agent that designs targeted experiments).

## Overview

Chaos engineering in Aurora QA follows the discipline of proactively injecting failures to discover weaknesses before they manifest in production. The system operates in three phases:

1. **Design** — The ChaosAgent analyzes your code and designs experiments targeting likely failure modes.
2. **Inject** — The ChaosEngine injects faults at runtime (network latency, failures, CPU stress, etc.).
3. **Score** — The system evaluates how gracefully your code handled the faults and produces a resilience score.

## ChaosEngine API

The `ChaosEngine` class provides programmatic fault injection. All injections are reversible and operate within the current Node.js process.

```typescript
import { ChaosEngine } from '@aurora-qa/core';

const engine = new ChaosEngine();
```

### Network Latency

Injects artificial delays into `fetch` calls.

```typescript
engine.injectNetworkLatency(ms: number, probability?: number): void
```

| Parameter     | Type     | Default | Description                          |
|---------------|----------|---------|--------------------------------------|
| `ms`          | `number` | —       | Latency to inject in milliseconds    |
| `probability` | `number` | `0.5`   | Probability of injection (0-1)       |

**Example:**

```typescript
engine.injectNetworkLatency(200, 0.5);
// 50% of fetch calls will be delayed by 200ms
```

### Network Failure

Randomly fails network requests by throwing errors from `fetch`.

```typescript
engine.injectNetworkFailure(probability?: number): void
```

| Parameter     | Type     | Default | Description                          |
|---------------|----------|---------|--------------------------------------|
| `probability` | `number` | `0.3`   | Probability of failure (0-1)         |

**Example:**

```typescript
engine.injectNetworkFailure(0.1);
// 10% of fetch calls will throw "ChaosEngine: Network failure injected"
```

### CPU Stress

Blocks the event loop to simulate CPU-bound load.

```typescript
engine.injectCPUStress(durationMs: number, intervalMs?: number): void
```

| Parameter     | Type     | Default | Description                            |
|---------------|----------|---------|----------------------------------------|
| `durationMs`  | `number` | —       | Duration of each blocking episode      |
| `intervalMs`  | `number` | `1000`  | Interval between blocking episodes     |

**Example:**

```typescript
engine.injectCPUStress(50, 500);
// Blocks the event loop for 50ms every 500ms
```

### Memory Pressure

Allocates memory buffers to test garbage collection behavior and memory-constrained operation.

```typescript
engine.injectMemoryPressure(sizeMB: number): void
```

| Parameter | Type     | Description                              |
|-----------|----------|------------------------------------------|
| `sizeMB`  | `number` | Amount of memory to allocate in megabytes|

**Example:**

```typescript
engine.injectMemoryPressure(256);
// Allocates 256MB of memory
```

### Random Errors

Wraps specified functions to throw errors at a configurable probability.

```typescript
engine.injectRandomErrors(probability?: number): void
```

| Parameter     | Type     | Default | Description                          |
|---------------|----------|---------|--------------------------------------|
| `probability` | `number` | `0.1`   | Probability of error (0-1)           |

### Time Skew

Offsets `Date.now()` to simulate clock drift for testing temporal logic.

```typescript
engine.injectTimeSkew(offsetMs: number): void
```

| Parameter   | Type     | Description                                |
|-------------|----------|--------------------------------------------|
| `offsetMs`  | `number` | Offset in milliseconds (positive = future) |

**Example:**

```typescript
engine.injectTimeSkew(3600 * 1000);
// Date.now() returns timestamps 1 hour in the future
```

### Reset

Removes all active injections and restores original behavior.

```typescript
engine.reset(): void
```

### Listing Active Injections

```typescript
engine.getActiveInjections(): Map<string, InjectionRecord>
```

Returns a map of all currently active injections with their configuration and creation timestamps.

## ChaosAgent

The `ChaosAgent` uses AI to analyze your source code and design targeted chaos experiments. It considers the system's architecture, failure modes, and recovery patterns.

### Designing an Experiment

```typescript
import { ChaosAgent, ChaosEngine } from '@aurora-qa/core';

const engine = new ChaosEngine();
const agent = new ChaosAgent(config, engine);

const experiment = await agent.designExperiment({
  sourceCode: myServiceCode,
  systemDescription: 'HTTP API service with Redis cache and PostgreSQL database',
  targetResilience: 0.8,
});
```

### Experiment Design Output

The agent returns a `ChaosExperimentDesign` with the following structure:

| Field            | Type                  | Description                              |
|------------------|-----------------------|------------------------------------------|
| `name`           | `string`              | Experiment name                          |
| `hypothesis`     | `string`              | What the experiment tests                |
| `injections`     | `InjectionPlan[]`     | Planned fault injections                 |
| `expectedBehavior` | `string`            | How the system should respond            |
| `measurements`   | `string[]`            | What to observe during the experiment    |
| `rollbackPlan`   | `string`              | How to undo the experiment               |
| `riskLevel`      | `string`              | `low` / `medium` / `high`               |

### Injection Types Summary

| Injection Type     | Target           | Impact                                |
|--------------------|------------------|---------------------------------------|
| `network-latency`  | `globalThis.fetch` | Adds artificial delay to HTTP calls |
| `network-failure`  | `globalThis.fetch` | Throws errors from HTTP calls       |
| `cpu-stress`       | Event loop       | Blocks the main thread periodically   |
| `memory-pressure`  | Heap memory      | Allocates large buffers               |
| `random-errors`    | Function calls   | Randomly throws errors                |
| `time-skew`        | `Date.now()`     | Offsets system time                   |

## Resilience Scoring

After running an experiment, the system evaluates resilience based on:

1. **Error handling** (30%) — Did the system catch and handle injected errors gracefully?
2. **Degradation** (25%) — Did the system degrade gracefully rather than crash?
3. **Recovery time** (20%) — How quickly did the system recover after injection stopped?
4. **Data integrity** (15%) — Was data corrupted or lost during the experiment?
5. **User impact** (10%) — Would end users notice the injected fault?

The final resilience score is a weighted average on a 0-1 scale:

| Score Range | Rating     | Interpretation                               |
|-------------|------------|----------------------------------------------|
| 0.9 - 1.0  | Excellent  | System is highly resilient                   |
| 0.7 - 0.89 | Good       | System handles most failures well            |
| 0.5 - 0.69 | Fair       | Some failure modes are not handled           |
| 0.3 - 0.49 | Poor       | System is fragile under stress               |
| 0.0 - 0.29 | Critical   | System fails catastrophically under stress   |

## End-to-End Example

```typescript
import { ChaosEngine, ChaosAgent, loadConfig } from '@aurora-qa/core';

const config = loadConfig();
const engine = new ChaosEngine();
const agent = new ChaosAgent(config, engine);

// 1. Design an experiment
const experiment = await agent.designExperiment({
  sourceCode: `
    async function fetchUserProfile(userId: string) {
      const response = await fetch(\`/api/users/\${userId}\`);
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    }
  `,
  systemDescription: 'User profile fetching service',
  targetResilience: 0.8,
});

console.log('Experiment:', experiment.name);
console.log('Hypothesis:', experiment.hypothesis);
console.log('Injections:', experiment.injections);

// 2. Apply injections
engine.injectNetworkLatency(500, 0.3);
engine.injectNetworkFailure(0.1);

// 3. Run your test suite under chaos conditions
// ... execute tests ...

// 4. Clean up
engine.reset();

// 5. Review results and resilience score
console.log('Active injections after reset:', engine.getActiveInjections().size); // 0
```

## Best Practices

1. **Start small**: begin with low injection probabilities and increase gradually.
2. **One variable at a time**: inject a single fault type per experiment to isolate effects.
3. **Always have a rollback plan**: use `engine.reset()` in a `finally` block.
4. **Run in isolation**: execute chaos experiments in a dedicated test environment, not against production.
5. **Establish baselines**: run your test suite without injections first to establish normal behavior.
6. **Automate**: integrate chaos experiments into your CI pipeline for continuous resilience validation.
