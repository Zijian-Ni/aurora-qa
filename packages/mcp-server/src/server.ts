import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { Orchestrator, AuroraConfig } from '@aurora-qa/core';
import { createTestTools } from './tools/test-tools.js';
import { createAnalysisTools } from './tools/analysis-tools.js';
import { logger } from '@aurora-qa/core';

type ToolHandlers = Record<
  string,
  { description: string; inputSchema: { parse: (v: unknown) => unknown }; handler: (i: unknown) => Promise<unknown> }
>;

export class AuroraQAMCPServer {
  private server: Server;
  private tools: ToolHandlers;
  private readonly log = logger.child('mcp-server');

  constructor(
    private orchestrator: Orchestrator,
    private config: AuroraConfig,
  ) {
    this.server = new Server(
      { name: config.mcp.name, version: config.mcp.version },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.tools = {
      ...createTestTools(orchestrator),
      ...createAnalysisTools(orchestrator),
    } as ToolHandlers;

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(this.tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: this.zodToJsonSchema(name),
      })),
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      const tool = this.tools[name];

      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }

      this.log.info(`Tool call: ${name}`);

      try {
        const parsed = tool.inputSchema.parse(args);
        const result = await tool.handler(parsed);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.log.error(`Tool error: ${name}`, err);

        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'aurora://health',
          name: 'Health Status',
          description: 'Aurora QA orchestrator health and agent status',
          mimeType: 'application/json',
        },
        {
          uri: 'aurora://knowledge/stats',
          name: 'Knowledge Base Stats',
          description: 'Statistics about the Aurora QA knowledge base',
          mimeType: 'application/json',
        },
        {
          uri: 'aurora://pipelines/history',
          name: 'Pipeline History',
          description: 'Recent pipeline run history',
          mimeType: 'application/json',
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async request => {
      const { uri } = request.params;

      switch (uri) {
        case 'aurora://health': {
          const health = this.orchestrator.health();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(health, null, 2),
              },
            ],
          };
        }

        case 'aurora://knowledge/stats': {
          const stats = this.orchestrator.knowledgeBase.stats();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        }

        case 'aurora://pipelines/history': {
          const history = this.orchestrator.getPipelineHistory(20);
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(history, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // Error handling
    this.server.onerror = error => {
      this.log.error('MCP server error', error);
    };

    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log.info(`Aurora QA MCP server started (${this.config.mcp.name} v${this.config.mcp.version})`);
  }

  async shutdown(): Promise<void> {
    this.log.info('MCP server shutting down...');
    await this.orchestrator.shutdown();
    await this.server.close();
  }

  /**
   * Return a minimal JSON Schema for each tool's input.
   * The actual validation is done by Zod in the handler.
   */
  private zodToJsonSchema(toolName: string): Record<string, unknown> {
    // Inline simplified schemas for MCP tool listing
    const schemas: Record<string, unknown> = {
      generate_tests: {
        type: 'object',
        properties: {
          sourceCode: { type: 'string' },
          filePath: { type: 'string' },
          framework: { type: 'string', enum: ['jest', 'vitest', 'mocha', 'jasmine', 'node:test'] },
          maxTests: { type: 'number' },
          focusAreas: { type: 'array', items: { type: 'string' } },
          existingTests: { type: 'string' },
        },
        required: ['sourceCode', 'filePath'],
      },
      run_tests: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          cwd: { type: 'string' },
          timeout: { type: 'number' },
        },
        required: ['command'],
      },
      analyze_bugs: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          filePath: { type: 'string' },
          language: { type: 'string' },
          context: { type: 'string' },
          errorMessage: { type: 'string' },
          testOutput: { type: 'string' },
        },
        required: ['code', 'filePath'],
      },
      review_code: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          filePath: { type: 'string' },
          language: { type: 'string' },
          context: { type: 'string' },
          strictness: { type: 'string', enum: ['lenient', 'standard', 'strict'] },
          focusAreas: { type: 'array', items: { type: 'string' } },
        },
        required: ['code', 'filePath'],
      },
      analyze_coverage: {
        type: 'object',
        properties: {
          coverageJson: { type: 'string' },
          coverageSummary: { type: 'string' },
          thresholds: {
            type: 'object',
            properties: {
              statements: { type: 'number' },
              branches: { type: 'number' },
              functions: { type: 'number' },
              lines: { type: 'number' },
            },
          },
        },
      },
      query_knowledge: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: {
            type: 'string',
            enum: ['test-pattern', 'bug-pattern', 'code-insight', 'fix-recipe', 'coverage-gap', 'review-pattern'],
          },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    };

    return (schemas[toolName] ?? { type: 'object', properties: {} }) as Record<string, unknown>;
  }
}
