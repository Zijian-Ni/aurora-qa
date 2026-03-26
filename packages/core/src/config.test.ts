import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('should return default config with valid API key', () => {
    const config = loadConfig({ anthropicApiKey: 'sk-test-key' });
    expect(config.model).toBe('claude-opus-4-6');
    expect(config.maxTokens).toBe(8192);
    expect(config.temperature).toBe(0.2);
    expect(config.memory.maxEntries).toBe(50_000);
    expect(config.memory.similarityThreshold).toBe(0.72);
    expect(config.dashboard.port).toBe(3001);
    expect(config.logging.level).toBe('info');
    expect(config.logging.format).toBe('pretty');
    expect(config.mcp.name).toBe('aurora-qa');
  });

  it('should accept overrides', () => {
    const config = loadConfig({
      anthropicApiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
      temperature: 0.8,
    });
    expect(config.model).toBe('claude-sonnet-4-6');
    expect(config.maxTokens).toBe(4096);
    expect(config.temperature).toBe(0.8);
  });

  it('should reject invalid temperature range', () => {
    expect(() => loadConfig({ anthropicApiKey: 'sk-test', temperature: 2.0 })).toThrow();
    expect(() => loadConfig({ anthropicApiKey: 'sk-test', temperature: -1 })).toThrow();
  });

  it('should reject invalid port numbers', () => {
    expect(() =>
      loadConfig({ anthropicApiKey: 'sk-test', dashboard: { port: 0, host: 'localhost', corsOrigins: [] } }),
    ).toThrow();
    expect(() =>
      loadConfig({ anthropicApiKey: 'sk-test', dashboard: { port: 99999, host: 'localhost', corsOrigins: [] } }),
    ).toThrow();
  });

  it('should accept nested memory config', () => {
    const config = loadConfig({
      anthropicApiKey: 'sk-test',
      memory: { maxEntries: 1000, similarityThreshold: 0.5 },
    });
    expect(config.memory.maxEntries).toBe(1000);
    expect(config.memory.similarityThreshold).toBe(0.5);
  });

  it('should reject invalid logging level', () => {
    expect(() =>
      // @ts-expect-error — intentionally invalid
      loadConfig({ anthropicApiKey: 'sk-test', logging: { level: 'verbose' } }),
    ).toThrow();
  });
});
