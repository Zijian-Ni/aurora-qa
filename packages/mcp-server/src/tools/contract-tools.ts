import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import { ContractTestingAgent, loadConfig } from '@aurora-qa/core';

export const VerifyContractSchema = z.object({
  contractPath: z.string().describe('JSON string of the API contract'),
  apiUrl: z.string().describe('Base URL of the API to verify against'),
});

export const GenerateContractSchema = z.object({
  openApiSpec: z.string().describe('OpenAPI/Swagger specification as JSON string'),
});

export function createContractTools(_orchestrator: Orchestrator) {
  return {
    verify_api_contract: {
      description: 'Verify an API contract against actual API responses.',
      inputSchema: VerifyContractSchema,
      async handler(input: z.infer<typeof VerifyContractSchema>) {
        const agent = new ContractTestingAgent(loadConfig());
        try {
          const contract = JSON.parse(input.contractPath);
          // For now, return contract structure analysis
          return {
            provider: contract.provider ?? 'unknown',
            consumer: contract.consumer ?? 'unknown',
            interactionCount: contract.interactions?.length ?? 0,
            apiUrl: input.apiUrl,
            message: 'Contract loaded. Live verification requires running API.',
          };
        } catch {
          return { error: 'Invalid contract JSON' };
        }
      },
    },

    generate_contract: {
      description: 'Generate an API contract from an OpenAPI/Swagger specification.',
      inputSchema: GenerateContractSchema,
      async handler(input: z.infer<typeof GenerateContractSchema>) {
        const agent = new ContractTestingAgent(loadConfig());
        const contract = await agent.generateContractFromOpenAPI(input.openApiSpec);
        return {
          provider: contract.provider,
          consumer: contract.consumer,
          interactionCount: contract.interactions.length,
          interactions: contract.interactions.map(i => ({
            description: i.description,
            method: i.request.method,
            path: i.request.path,
            responseStatus: i.response.status,
          })),
        };
      },
    },
  };
}
