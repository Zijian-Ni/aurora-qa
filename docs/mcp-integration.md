# MCP Integration Guide

Aurora QA exposes 12 tools via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), allowing AI assistants like Claude Desktop, Cursor, and VS Code Copilot to directly invoke Aurora QA capabilities during coding sessions.

## Overview

The MCP server (`@aurora-qa/mcp-server`) wraps the Aurora QA `Orchestrator` and exposes each agent's primary function as an MCP tool. It communicates over stdio using the MCP JSON-RPC protocol.

## Prerequisites

1. **Node.js 20+** installed
2. **pnpm 9+** installed
3. **Aurora QA built**:
   ```bash
   cd aurora-qa
   pnpm install
   pnpm build
   ```
4. **Anthropic API key** set as an environment variable

## Available MCP Tools

| Tool                       | Description                                    |
|----------------------------|------------------------------------------------|
| `generate_tests`           | Generate comprehensive test cases              |
| `run_tests`                | Execute tests and return structured results    |
| `analyze_bugs`             | Deep static analysis for bugs                  |
| `review_code`              | Thorough code review with scoring              |
| `analyze_coverage`         | Coverage gap analysis                          |
| `query_knowledge`          | Search the knowledge base for patterns         |
| `scan_security`            | OWASP security scanning                        |
| `check_dependencies`       | Vulnerable dependency detection                |
| `design_chaos_experiment`  | Design chaos engineering scenarios             |
| `check_accessibility`      | WCAG compliance checking                       |
| `analyze_performance`      | Performance issue detection                    |
| `run_mutation_testing`     | Mutation testing for test quality              |

## Claude Desktop

Add the following to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aurora-qa": {
      "command": "node",
      "args": [
        "/absolute/path/to/aurora-qa/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here",
        "AURORA_MODEL": "claude-opus-4-6"
      }
    }
  }
}
```

After saving, restart Claude Desktop. You should see the Aurora QA tools listed in the tool picker (hammer icon).

### Using npx

If you prefer not to pre-build, you can use `npx` with `tsx`:

```json
{
  "mcpServers": {
    "aurora-qa": {
      "command": "npx",
      "args": [
        "-y", "tsx",
        "/absolute/path/to/aurora-qa/packages/mcp-server/src/index.ts"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

## Cursor

Add to your Cursor MCP configuration at `.cursor/mcp.json` in your project root (or globally at `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "aurora-qa": {
      "command": "node",
      "args": [
        "/absolute/path/to/aurora-qa/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here",
        "AURORA_MODEL": "claude-opus-4-6"
      }
    }
  }
}
```

After saving, open the Cursor command palette and run **MCP: Restart Servers** to pick up the new configuration.

## VS Code

### Using the MCP Extension

If you are using VS Code with an MCP-compatible extension (such as the Claude extension or GitHub Copilot with MCP support), add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "aurora-qa": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/aurora-qa/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here",
        "AURORA_MODEL": "claude-opus-4-6"
      }
    }
  }
}
```

### Using VS Code Settings

Alternatively, add to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "aurora-qa": {
      "command": "node",
      "args": [
        "/absolute/path/to/aurora-qa/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

## Configuration Options

The MCP server respects the following environment variables:

| Variable             | Default          | Description                        |
|----------------------|------------------|------------------------------------|
| `ANTHROPIC_API_KEY`  | (required)       | Anthropic API key                  |
| `AURORA_MODEL`       | `claude-opus-4-6`       | Model to use for agent reasoning   |
| `AURORA_MAX_TOKENS`  | `8192`           | Maximum tokens per API response    |
| `AURORA_TEMPERATURE` | `0.2`            | Sampling temperature               |
| `AURORA_LOG_LEVEL`   | `info`           | Logging level                      |
| `AURORA_LOG_FORMAT`  | `pretty`         | Log format (`json` or `pretty`)    |
| `AURORA_MEMORY_PATH` | (none)           | Path for persisting knowledge base |

## Usage Examples

Once connected, you can ask your AI assistant to use Aurora QA tools naturally:

### Generate Tests

> "Use aurora-qa to generate tests for this file"

The assistant will call the `generate_tests` tool with the file contents and return a complete test suite.

### Security Scan

> "Scan this code for security vulnerabilities using aurora-qa"

The assistant will call `scan_security` and return a structured vulnerability report.

### Code Review

> "Review this pull request with aurora-qa"

The assistant will call `review_code` and provide a quality score with detailed feedback.

### Chaos Engineering

> "Design a chaos experiment for this microservice"

The assistant will call `design_chaos_experiment` and return a targeted fault injection plan.

## Troubleshooting

### Tools not appearing

1. Verify the path to `dist/index.js` is correct and the file exists.
2. Ensure `pnpm build` completed successfully.
3. Check that `ANTHROPIC_API_KEY` is set.
4. Restart the AI assistant application.

### Connection errors

Run the MCP server manually to check for startup errors:

```bash
ANTHROPIC_API_KEY=sk-ant-... node packages/mcp-server/dist/index.js
```

The server communicates over stdio. If it starts without error, the issue is likely in the client configuration.

### Timeout errors

Some tools (particularly `run_tests` and `run_mutation_testing`) can take longer to complete. If you encounter timeouts, ensure your MCP client is configured with a sufficient timeout. Most clients default to 60 seconds, which should be adequate.
