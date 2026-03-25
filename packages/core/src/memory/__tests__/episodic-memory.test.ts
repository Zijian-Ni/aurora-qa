import { describe, it, expect, beforeEach } from 'vitest';
import { EpisodicMemory } from '../episodic-memory.js';

describe('EpisodicMemory', () => {
  let memory: EpisodicMemory;

  beforeEach(() => {
    memory = new EpisodicMemory({ maxEntries: 100 });
  });

  it('should store episodes', () => {
    memory.store_episode({
      id: 'ep-1',
      type: 'test-run',
      content: 'Ran authentication tests, all passed',
      tags: ['auth', 'passing'],
      outcome: 'success',
      timestamp: new Date(),
    });

    expect(memory.size).toBe(1);
  });

  it('should recall episodes with time decay', () => {
    // Recent episode
    memory.store_episode({
      id: 'ep-recent',
      type: 'test-run',
      content: 'Recent authentication test failure',
      tags: ['auth', 'failure'],
      outcome: 'failure',
      timestamp: new Date(),
    });

    // Old episode
    memory.store_episode({
      id: 'ep-old',
      type: 'test-run',
      content: 'Old authentication test success',
      tags: ['auth', 'success'],
      outcome: 'success',
      timestamp: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    });

    const results = memory.recall('authentication test', 2);
    expect(results.length).toBeGreaterThan(0);
    // Recent episodes should score higher due to recency weighting
    if (results.length > 1) {
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
    }
  });

  it('should forget episodes', () => {
    memory.store_episode({
      id: 'ep-forget',
      type: 'test-run',
      content: 'Episode to forget',
      tags: [],
      outcome: 'success',
      timestamp: new Date(),
    });
    expect(memory.size).toBe(1);
    memory.forget('ep-forget');
    expect(memory.size).toBe(0);
  });

  it('should get patterns', () => {
    for (let i = 0; i < 5; i++) {
      memory.store_episode({
        id: `ep-${i}`,
        type: 'test-run',
        content: `Test run ${i}`,
        tags: ['auth', 'unit'],
        outcome: 'success',
        timestamp: new Date(),
      });
    }

    const patterns = memory.getPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.pattern === 'auth')).toBe(true);
  });

  it('should prune old episodes', () => {
    memory.store_episode({
      id: 'ep-old',
      type: 'test-run',
      content: 'Old episode',
      tags: [],
      outcome: 'success',
      timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });
    memory.store_episode({
      id: 'ep-new',
      type: 'test-run',
      content: 'New episode',
      tags: [],
      outcome: 'success',
      timestamp: new Date(),
    });

    const pruned = memory.pruneOld(30);
    expect(pruned).toBe(1);
    expect(memory.size).toBe(1);
  });

  it('should return stats', () => {
    memory.store_episode({
      id: 'ep-1',
      type: 'test-run',
      content: 'A test episode',
      tags: ['test'],
      outcome: 'success',
      timestamp: new Date(),
    });

    const stats = memory.stats();
    expect(stats.totalEpisodes).toBe(1);
    expect(stats.oldestEpisode).toBeInstanceOf(Date);
  });
});
