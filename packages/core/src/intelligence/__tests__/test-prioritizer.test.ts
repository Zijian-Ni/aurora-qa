import { describe, it, expect } from 'vitest';
import { TestPrioritizer } from '../test-prioritizer.js';

describe('TestPrioritizer', () => {
  const prioritizer = new TestPrioritizer();

  const tests = [
    { id: 't1', name: 'auth login test', filePath: 'src/auth/login.test.ts', executionTimeMs: 500, tags: ['auth', 'critical'] },
    { id: 't2', name: 'utils format test', filePath: 'src/utils/format.test.ts', executionTimeMs: 100, tags: ['utils'] },
    { id: 't3', name: 'payment checkout test', filePath: 'src/payment/checkout.test.ts', executionTimeMs: 2000, tags: ['payment', 'critical'] },
    { id: 't4', name: 'ui button test', filePath: 'src/ui/button.test.ts', executionTimeMs: 50, tags: ['ui'] },
  ];

  it('should prioritize tests near changed files', () => {
    const result = prioritizer.prioritize(tests, ['src/auth/login.ts']);
    expect(result[0]!.testId).toBe('t1');
  });

  it('should return priority scores between 0 and 100', () => {
    const result = prioritizer.prioritize(tests, ['src/auth/login.ts']);
    for (const test of result) {
      expect(test.priority).toBeGreaterThanOrEqual(0);
      expect(test.priority).toBeLessThanOrEqual(100);
    }
  });

  it('should factor in historical failure rate', () => {
    const history = [
      { testId: 't2', results: Array.from({ length: 10 }, () => ({ passed: false, timestamp: new Date() })) },
    ];
    const result = prioritizer.prioritize(tests, [], {}, history);
    const t2Priority = result.find(r => r.testId === 't2');
    expect(t2Priority).toBeDefined();
    expect(t2Priority!.factors.failureRate).toBeGreaterThan(0);
  });

  it('should boost critical-tagged tests', () => {
    const result = prioritizer.prioritize(tests, [], { criticalPaths: ['src/payment/'] });
    const paymentTest = result.find(r => r.testId === 't3');
    expect(paymentTest).toBeDefined();
    expect(paymentTest!.factors.businessCriticality).toBeGreaterThanOrEqual(0.85);
  });

  it('should select quick suite within time budget', () => {
    const prioritized = prioritizer.prioritize(tests, []);
    const timeMap = new Map(tests.map(t => [t.id, t.executionTimeMs]));
    const quickSuite = prioritizer.getQuickSuite(prioritized, 600, timeMap);

    const totalTime = quickSuite.reduce((sum, t) => sum + (timeMap.get(t.testId) ?? 0), 0);
    expect(totalTime).toBeLessThanOrEqual(600);
  });

  it('should predict flakiness from history', () => {
    const stableHistory = [
      { testId: 't1', results: Array.from({ length: 10 }, () => ({ passed: true, timestamp: new Date() })) },
    ];
    const stableFlakiness = prioritizer.predictFlakiness('t1', stableHistory);
    expect(stableFlakiness).toBe(0);

    const flakyHistory = [
      {
        testId: 't2',
        results: Array.from({ length: 10 }, (_, i) => ({ passed: i % 2 === 0, timestamp: new Date() })),
      },
    ];
    const flakyScore = prioritizer.predictFlakiness('t2', flakyHistory);
    expect(flakyScore).toBeGreaterThan(0.3);
  });

  it('should handle empty inputs', () => {
    const result = prioritizer.prioritize([], []);
    expect(result).toEqual([]);
  });

  it('should include factor breakdown for each test', () => {
    const result = prioritizer.prioritize(tests, ['src/auth/login.ts']);
    for (const test of result) {
      expect(test.factors).toHaveProperty('changeProximity');
      expect(test.factors).toHaveProperty('failureRate');
      expect(test.factors).toHaveProperty('executionTime');
      expect(test.factors).toHaveProperty('businessCriticality');
    }
  });
});
