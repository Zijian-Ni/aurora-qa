---
name: Agent Proposal
about: Propose a new AI agent for Aurora QA
title: "[Agent Proposal] "
labels: agent-proposal, enhancement
assignees: ""
---

## Agent Name

What should this agent be called? (e.g., `CompatibilityAgent`, `DocGenAgent`)

## Purpose

What quality engineering problem does this agent solve? (one sentence)

## Key Capabilities

- Capability 1
- Capability 2
- Capability 3

## Tools

What tools would this agent use in the agentic loop?

| Tool Name | Description | Input Schema |
|-----------|-------------|--------------|
| `tool_1`  | ...         | `{ ... }`    |
| `tool_2`  | ...         | `{ ... }`    |

## System Prompt (Draft)

```
You are Aurora's [Name] Agent — ...
```

## Input/Output

**Input:**

```typescript
interface AgentInput {
  // ...
}
```

**Output:**

```typescript
interface AgentOutput {
  // ...
}
```

## Integration Points

How does this agent interact with existing agents?

- Depends on: (e.g., TestGeneratorAgent output)
- Feeds into: (e.g., ReviewAgent input)
- Pipeline step type: (e.g., `my-step`)

## MCP Tool

Should this agent be exposed as an MCP tool?

- [ ] Yes — Tool name: `...`
- [ ] No

## Prior Art

Are there existing tools or services that do something similar? How does this differ?

## Willingness to Contribute

- [ ] I'm willing to implement this agent
- [ ] I'd like someone else to implement it
