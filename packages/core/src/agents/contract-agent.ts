import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  APIContract,
  ContractInteraction,
  ContractVerificationResult,
  ContractBreak,
} from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'define_interaction',
    description: 'Define an API contract interaction',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
        path: { type: 'string' },
        requestHeaders: { type: 'object' },
        requestBody: { type: 'object' },
        responseStatus: { type: 'number' },
        responseHeaders: { type: 'object' },
        responseBody: { type: 'object' },
      },
      required: ['description', 'method', 'path', 'responseStatus'],
    },
  },
  {
    name: 'report_contract_break',
    description: 'Report a breaking change detected between contracts',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['removed-endpoint', 'changed-response', 'new-required-field', 'type-change'] },
        description: { type: 'string' },
        breaking: { type: 'boolean' },
        path: { type: 'string' },
      },
      required: ['type', 'description', 'breaking', 'path'],
    },
  },
  {
    name: 'generate_consumer_test',
    description: 'Generate a consumer-side verification test',
    input_schema: {
      type: 'object' as const,
      properties: {
        testName: { type: 'string' },
        testCode: { type: 'string' },
        interaction: { type: 'string', description: 'Which interaction this tests' },
      },
      required: ['testName', 'testCode', 'interaction'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Contract Testing Agent — an API contract testing expert.

You help define, verify, and maintain API contracts between providers and consumers.
Inspired by Pact-style contract testing.

Responsibilities:
- Define contracts from OpenAPI specs or descriptions
- Verify actual API responses match contracts
- Detect breaking changes between contract versions
- Generate consumer-side verification tests`;

export class ContractTestingAgent extends BaseAgent {
  private interactions: ContractInteraction[] = [];
  private breaks: ContractBreak[] = [];
  private consumerTests: Array<{ testName: string; testCode: string; interaction: string }> = [];

  constructor(config: AuroraConfig) {
    super({
      role: 'contract-agent',
      name: 'ContractTestingAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async defineContract(
    provider: string,
    consumer: string,
    description: string,
  ): Promise<APIContract> {
    this.interactions = [];
    this.clearHistory();

    const prompt = [
      `Define an API contract between provider "${provider}" and consumer "${consumer}".`,
      ``,
      `Description: ${description}`,
      ``,
      `Call define_interaction for each API interaction in the contract.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 12 });

    return {
      provider,
      consumer,
      interactions: this.interactions,
      version: '1.0.0',
      createdAt: new Date(),
    };
  }

  verifyContract(
    contract: APIContract,
    actualResponses: Array<{ path: string; method: string; status: number; body: unknown }>,
  ): ContractVerificationResult {
    const failures: ContractVerificationResult['failures'] = [];

    for (const interaction of contract.interactions) {
      const actual = actualResponses.find(
        r => r.path === interaction.request.path && r.method === interaction.request.method,
      );

      if (!actual) {
        failures.push({
          interaction: interaction.description,
          expected: `${interaction.request.method} ${interaction.request.path}`,
          actual: 'NOT FOUND',
          error: 'Endpoint not found in actual responses',
        });
        continue;
      }

      if (actual.status !== interaction.response.status) {
        failures.push({
          interaction: interaction.description,
          expected: interaction.response.status,
          actual: actual.status,
          error: `Status code mismatch: expected ${interaction.response.status}, got ${actual.status}`,
        });
      }

      // Verify response shape if contract specifies a body
      if (interaction.response.body && actual.body) {
        const missingKeys = this.findMissingKeys(
          interaction.response.body as Record<string, unknown>,
          actual.body as Record<string, unknown>,
        );
        if (missingKeys.length > 0) {
          failures.push({
            interaction: interaction.description,
            expected: Object.keys(interaction.response.body as object),
            actual: Object.keys(actual.body as object),
            error: `Missing response fields: ${missingKeys.join(', ')}`,
          });
        }
      }
    }

    return {
      valid: failures.length === 0,
      failures,
      summary: failures.length === 0
        ? `All ${contract.interactions.length} interactions verified successfully`
        : `${failures.length} of ${contract.interactions.length} interactions failed verification`,
    };
  }

  async generateContractFromOpenAPI(openApiSpec: string): Promise<APIContract> {
    this.interactions = [];
    this.clearHistory();

    const prompt = [
      `Generate an API contract from this OpenAPI specification.`,
      ``,
      '```json',
      openApiSpec,
      '```',
      ``,
      `Call define_interaction for each endpoint.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 15 });

    return {
      provider: 'api',
      consumer: 'client',
      interactions: this.interactions,
      version: '1.0.0',
      createdAt: new Date(),
    };
  }

  async detectContractBreaks(
    oldContract: APIContract,
    newContract: APIContract,
  ): Promise<ContractBreak[]> {
    this.breaks = [];

    // Check removed endpoints
    for (const oldInteraction of oldContract.interactions) {
      const found = newContract.interactions.find(
        n => n.request.path === oldInteraction.request.path &&
             n.request.method === oldInteraction.request.method,
      );
      if (!found) {
        this.breaks.push({
          type: 'removed-endpoint',
          description: `Endpoint removed: ${oldInteraction.request.method} ${oldInteraction.request.path}`,
          breaking: true,
          path: oldInteraction.request.path,
        });
      }
    }

    // Check changed responses
    for (const newInteraction of newContract.interactions) {
      const old = oldContract.interactions.find(
        o => o.request.path === newInteraction.request.path &&
             o.request.method === newInteraction.request.method,
      );
      if (old) {
        if (old.response.status !== newInteraction.response.status) {
          this.breaks.push({
            type: 'changed-response',
            description: `Status changed for ${newInteraction.request.method} ${newInteraction.request.path}: ${old.response.status} → ${newInteraction.response.status}`,
            breaking: true,
            path: newInteraction.request.path,
          });
        }

        if (old.response.body && newInteraction.response.body) {
          const oldKeys = Object.keys(old.response.body as object);
          const newKeys = Object.keys(newInteraction.response.body as object);
          const removed = oldKeys.filter(k => !newKeys.includes(k));
          if (removed.length > 0) {
            this.breaks.push({
              type: 'changed-response',
              description: `Removed fields from ${newInteraction.request.path}: ${removed.join(', ')}`,
              breaking: true,
              path: newInteraction.request.path,
            });
          }
        }
      }
    }

    return this.breaks;
  }

  async generateConsumerTests(contract: APIContract): Promise<string> {
    this.consumerTests = [];
    this.clearHistory();

    const prompt = [
      `Generate consumer-side verification tests for this API contract.`,
      ``,
      `**Provider:** ${contract.provider}`,
      `**Consumer:** ${contract.consumer}`,
      `**Interactions:** ${contract.interactions.length}`,
      ``,
      '```json',
      JSON.stringify(contract.interactions, null, 2),
      '```',
      ``,
      `Call generate_consumer_test for each interaction.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 15 });

    return this.consumerTests.map(t => t.testCode).join('\n\n');
  }

  private findMissingKeys(expected: Record<string, unknown>, actual: Record<string, unknown>): string[] {
    const missing: string[] = [];
    for (const key of Object.keys(expected)) {
      if (!(key in actual)) {
        missing.push(key);
      }
    }
    return missing;
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'define_interaction': {
        this.interactions.push({
          description: String(input['description'] ?? ''),
          request: {
            method: String(input['method'] ?? 'GET'),
            path: String(input['path'] ?? '/'),
            headers: input['requestHeaders'] as Record<string, string> | undefined,
            body: input['requestBody'],
          },
          response: {
            status: Number(input['responseStatus'] ?? 200),
            headers: input['responseHeaders'] as Record<string, string> | undefined,
            body: input['responseBody'],
          },
        });
        return { success: true, count: this.interactions.length };
      }
      case 'report_contract_break': {
        this.breaks.push({
          type: input['type'] as ContractBreak['type'],
          description: String(input['description'] ?? ''),
          breaking: Boolean(input['breaking']),
          path: String(input['path'] ?? ''),
        });
        return { success: true, breakCount: this.breaks.length };
      }
      case 'generate_consumer_test': {
        this.consumerTests.push({
          testName: String(input['testName'] ?? ''),
          testCode: String(input['testCode'] ?? ''),
          interaction: String(input['interaction'] ?? ''),
        });
        return { success: true, testCount: this.consumerTests.length };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
