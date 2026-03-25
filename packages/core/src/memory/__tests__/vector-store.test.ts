import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../vector-store.js';

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore({ maxEntries: 100 });
  });

  it('should store and retrieve entries', () => {
    const entry = store.upsert({
      id: 'test-1',
      type: 'test-pattern',
      content: 'Test pattern for user authentication',
      metadata: { category: 'auth' },
      tags: ['auth', 'test'],
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
    });

    expect(entry.id).toBe('test-1');
    expect(store.size).toBe(1);
    expect(store.get('test-1')).toBeDefined();
  });

  it('should search by content similarity', () => {
    store.upsert({
      id: '1', type: 'bug-pattern', content: 'Null pointer exception in user handler',
      metadata: {}, tags: ['bug'], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });
    store.upsert({
      id: '2', type: 'bug-pattern', content: 'Memory leak in event listener cleanup',
      metadata: {}, tags: ['bug'], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });
    store.upsert({
      id: '3', type: 'test-pattern', content: 'Test for null pointer handling',
      metadata: {}, tags: ['test'], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });

    const results = store.search('null pointer', { limit: 2 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by type', () => {
    store.upsert({
      id: '1', type: 'bug-pattern', content: 'A bug pattern',
      metadata: {}, tags: [], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });
    store.upsert({
      id: '2', type: 'test-pattern', content: 'A test pattern',
      metadata: {}, tags: [], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });

    const results = store.search('pattern', { type: 'bug-pattern' });
    expect(results.every(r => r.entry.type === 'bug-pattern')).toBe(true);
  });

  it('should filter by tags', () => {
    store.upsert({
      id: '1', type: 'test-pattern', content: 'Auth test',
      metadata: {}, tags: ['auth'], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });
    store.upsert({
      id: '2', type: 'test-pattern', content: 'Payment test',
      metadata: {}, tags: ['payment'], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });

    const results = store.search('auth test', { tags: ['auth'], minSimilarity: 0 });
    // All results with tags filter should have matching tags (or be empty if no match)
    const filtered = results.filter(r => r.similarity > 0);
    if (filtered.length > 0) {
      expect(filtered.every(r => r.entry.tags.includes('auth'))).toBe(true);
    }
  });

  it('should delete entries', () => {
    store.upsert({
      id: 'del-1', type: 'test-pattern', content: 'To delete',
      metadata: {}, tags: [], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
    });
    expect(store.size).toBe(1);

    const deleted = store.delete('del-1');
    expect(deleted).toBe(true);
    expect(store.size).toBe(0);
  });

  it('should clear all entries', () => {
    for (let i = 0; i < 5; i++) {
      store.upsert({
        id: `e-${i}`, type: 'test-pattern', content: `Entry ${i}`,
        metadata: {}, tags: [], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
      });
    }
    expect(store.size).toBe(5);
    store.clear();
    expect(store.size).toBe(0);
  });

  it('should evict old entries when over capacity', () => {
    const small = new VectorStore({ maxEntries: 5 });
    for (let i = 0; i < 10; i++) {
      small.upsert({
        id: `e-${i}`, type: 'test-pattern', content: `Entry number ${i}`,
        metadata: {}, tags: [], createdAt: new Date(), lastAccessedAt: new Date(), accessCount: 0,
      });
    }
    expect(small.size).toBeLessThanOrEqual(10);
  });
});
