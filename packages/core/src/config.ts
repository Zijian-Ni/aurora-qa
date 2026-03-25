import { z } from 'zod';
import type { AuroraConfig } from './types/index.js';

const ConfigSchema = z.object({
  anthropicApiKey: z.string().default(() => process.env['ANTHROPIC_API_KEY'] ?? ''),
  model: z.string().default(() => process.env['AURORA_MODEL'] ?? 'claude-opus-4-6'),
  maxTokens: z.coerce.number().default(8192),
  temperature: z.coerce.number().min(0).max(1).default(0.2),
  memory: z
    .object({
      maxEntries: z.coerce.number().default(50_000),
      similarityThreshold: z.coerce.number().default(0.72),
      persistPath: z.string().optional(),
    })
    .default({}),
  dashboard: z
    .object({
      port: z.coerce.number().default(() => Number(process.env['DASHBOARD_PORT'] ?? 3001)),
      host: z.string().default(() => process.env['DASHBOARD_HOST'] ?? '0.0.0.0'),
      corsOrigins: z
        .array(z.string())
        .default(() =>
          process.env['CORS_ORIGINS']
            ? (process.env['CORS_ORIGINS'] as string).split(',')
            : ['http://localhost:3000', 'http://localhost:5173'],
        ),
    })
    .default({}),
  mcp: z
    .object({
      name: z.string().default('aurora-qa'),
      version: z.string().default('1.0.0'),
    })
    .default({}),
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      format: z.enum(['json', 'pretty']).default('pretty'),
    })
    .default({}),
});

export type Config = AuroraConfig;

export function loadConfig(overrides: Partial<AuroraConfig> = {}): AuroraConfig {
  return ConfigSchema.parse(overrides) as AuroraConfig;
}

export const defaultConfig: AuroraConfig = loadConfig();
