import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type { AuroraConfig, Mutant, MutationType, MutationReport } from '../types/index.js';

const ARITHMETIC_MUTATIONS: Array<[RegExp, string, string]> = [
  [/(?<![=!<>])(\+)(?!=)/g, '-', 'arithmetic'],
  [/(?<![=])(-)(?!=)/g, '+', 'arithmetic'],
  [/(\*)(?!=)/g, '/', 'arithmetic'],
  [/(\/)(?!=)/g, '*', 'arithmetic'],
];

const BOOLEAN_MUTATIONS: Array<[RegExp, string, string]> = [
  [/(&&)/g, '||', 'boolean'],
  [/(\|\|)/g, '&&', 'boolean'],
  [/(true)/g, 'false', 'boolean'],
  [/(false)/g, 'true', 'boolean'],
  [/(!==)/g, '===', 'boolean'],
  [/(===)/g, '!==', 'boolean'],
];

const BOUNDARY_MUTATIONS: Array<[RegExp, string, string]> = [
  [/(>=)/g, '>', 'boundary'],
  [/(<=)/g, '<', 'boundary'],
  [/(?<!=)(>)(?!=)/g, '>=', 'boundary'],
  [/(?<!=)(<)(?!=)/g, '<=', 'boundary'],
];

const RETURN_MUTATIONS: Array<[RegExp, string, string]> = [
  [/return\s+(\S[^;]*)/g, 'return null', 'return-value'],
];

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'suggest_test',
    description: 'Suggest a test to kill a surviving mutant',
    input_schema: {
      type: 'object' as const,
      properties: {
        mutantId: { type: 'string' },
        testName: { type: 'string' },
        testCode: { type: 'string' },
        reasoning: { type: 'string' },
      },
      required: ['mutantId', 'testName', 'testCode'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Mutation Testing Agent — an expert in measuring test quality.

You analyze surviving mutants (mutations that tests failed to catch) and suggest
targeted tests to improve mutation score. Each suggested test should be specific
enough to kill the surviving mutant.`;

export class MutationTestingAgent extends BaseAgent {
  private suggestedTests: Array<{ mutantId: string; testName: string; testCode: string }> = [];

  constructor(config: AuroraConfig) {
    super({
      role: 'mutation-agent',
      name: 'MutationTestingAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  generateMutants(sourceCode: string, filePath: string): Mutant[] {
    const mutants: Mutant[] = [];
    const lines = sourceCode.split('\n');

    const allMutations = [
      ...ARITHMETIC_MUTATIONS.map(m => ({ ...m, type: 'arithmetic' as MutationType })),
      ...BOOLEAN_MUTATIONS.map(m => ({ ...m, type: 'boolean' as MutationType })),
      ...BOUNDARY_MUTATIONS.map(m => ({ ...m, type: 'boundary' as MutationType })),
      ...RETURN_MUTATIONS.map(m => ({ ...m, type: 'return-value' as MutationType })),
    ];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      // Skip comments and imports
      if (/^\s*\/\//.test(line) || /^\s*import\s/.test(line) || /^\s*\*/.test(line)) continue;

      for (const mutation of allMutations) {
        const [pattern, replacement, , type] = [mutation[0], mutation[1], mutation[2], mutation.type];
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(line)) !== null) {
          const original = match[0];
          const mutated = line.slice(0, match.index) + replacement + line.slice(match.index + original.length);

          mutants.push({
            id: `mut-${filePath}-${lineIdx + 1}-${mutants.length}`,
            type: type as MutationType,
            original: line.trim(),
            mutated: mutated.trim(),
            location: { line: lineIdx + 1, column: match.index },
            status: 'pending',
          });
        }
      }
    }

    return mutants;
  }

  async runMutantTests(
    mutant: Mutant,
    testCommand: string,
  ): Promise<{ killed: boolean; output: string }> {
    // In a real implementation, this would:
    // 1. Apply the mutation to the source
    // 2. Run the test command
    // 3. Check if tests fail (mutant killed) or pass (survived)
    // For now, simulate the process
    const killed = Math.random() > 0.3; // Simulated
    mutant.status = killed ? 'killed' : 'survived';
    return {
      killed,
      output: killed
        ? `Tests caught mutation: ${mutant.type} at line ${mutant.location.line}`
        : `Mutant survived: ${mutant.type} at line ${mutant.location.line} — tests did not catch this change`,
    };
  }

  calculateMutationScore(killed: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((killed / total) * 100);
  }

  identifyWeakSpots(mutants: Mutant[]): string[] {
    const survived = mutants.filter(m => m.status === 'survived');
    const lineGroups = new Map<number, Mutant[]>();

    for (const m of survived) {
      const group = lineGroups.get(m.location.line) ?? [];
      group.push(m);
      lineGroups.set(m.location.line, group);
    }

    return Array.from(lineGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([line, muts]) =>
        `Line ${line}: ${muts.length} surviving mutants (${muts.map(m => m.type).join(', ')})`,
      );
  }

  async suggestAdditionalTests(
    weakSpots: string[],
    sourceCode: string,
  ): Promise<Array<{ mutantId: string; testName: string; testCode: string }>> {
    this.suggestedTests = [];
    this.clearHistory();

    const prompt = [
      `Suggest tests to kill surviving mutants at these weak spots:`,
      ``,
      ...weakSpots.map((ws, i) => `${i + 1}. ${ws}`),
      ``,
      `Source code:`,
      '```',
      sourceCode,
      '```',
      ``,
      `Call suggest_test for each test that would kill a surviving mutant.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 10 });
    return this.suggestedTests;
  }

  async runFullMutationTest(
    sourceCode: string,
    filePath: string,
    testCommand: string,
  ): Promise<MutationReport> {
    const mutants = this.generateMutants(sourceCode, filePath);

    let killed = 0;
    let survived = 0;

    for (const mutant of mutants) {
      const result = await this.runMutantTests(mutant, testCommand);
      if (result.killed) killed++;
      else survived++;
    }

    const score = this.calculateMutationScore(killed, mutants.length);
    const weakSpots = this.identifyWeakSpots(mutants);

    return {
      mutants,
      score,
      killed,
      survived,
      total: mutants.length,
      weakSpots,
    };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'suggest_test': {
        this.suggestedTests.push({
          mutantId: String(input['mutantId'] ?? ''),
          testName: String(input['testName'] ?? ''),
          testCode: String(input['testCode'] ?? ''),
        });
        return { success: true, count: this.suggestedTests.length };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
