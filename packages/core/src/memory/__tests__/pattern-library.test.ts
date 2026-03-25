import { describe, it, expect, beforeEach } from 'vitest';
import { PatternLibrary } from '../pattern-library.js';

describe('PatternLibrary', () => {
  let library: PatternLibrary;

  beforeEach(() => {
    library = new PatternLibrary();
  });

  it('should add and retrieve patterns', () => {
    library.addPattern({
      id: 'p1',
      name: 'Auth Test Pattern',
      description: 'Pattern for testing authentication flows',
      pattern: 'describe → login → assert token',
      successRate: 0.9,
      usageCount: 10,
      tags: ['auth', 'integration'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(library.size).toBe(1);
    expect(library.getPattern('p1')).toBeDefined();
  });

  it('should match patterns by context', () => {
    library.addPattern({
      id: 'p1',
      name: 'Auth Pattern',
      description: 'Testing authentication login flow',
      pattern: 'login flow',
      successRate: 0.95,
      usageCount: 20,
      tags: ['auth'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    library.addPattern({
      id: 'p2',
      name: 'Payment Pattern',
      description: 'Testing payment processing checkout',
      pattern: 'checkout flow',
      successRate: 0.8,
      usageCount: 5,
      tags: ['payment'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const match = library.matchPattern({ description: 'authentication login test', tags: ['auth'] });
    expect(match).not.toBeNull();
    expect(match?.id).toBe('p1');
  });

  it('should update pattern success rate', () => {
    library.addPattern({
      id: 'p1',
      name: 'Test',
      description: 'Test pattern',
      pattern: 'test',
      successRate: 0.5,
      usageCount: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    library.updatePatternSuccess('p1', true);
    const pattern = library.getPattern('p1')!;
    expect(pattern.usageCount).toBe(1);
    expect(pattern.successRate).toBeGreaterThan(0.5);
  });

  it('should get top patterns sorted by effectiveness', () => {
    library.addPattern({
      id: 'p1', name: 'Good', description: 'Good pattern', pattern: '', successRate: 0.95, usageCount: 50,
      tags: [], createdAt: new Date(), updatedAt: new Date(),
    });
    library.addPattern({
      id: 'p2', name: 'Bad', description: 'Bad pattern', pattern: '', successRate: 0.3, usageCount: 5,
      tags: [], createdAt: new Date(), updatedAt: new Date(),
    });
    library.addPattern({
      id: 'p3', name: 'Medium', description: 'Medium pattern', pattern: '', successRate: 0.7, usageCount: 20,
      tags: [], createdAt: new Date(), updatedAt: new Date(),
    });

    const top = library.getTopPatterns(2);
    expect(top.length).toBe(2);
    expect(top[0]!.id).toBe('p1');
  });

  it('should export and import patterns', () => {
    library.addPattern({
      id: 'p1', name: 'Export Test', description: 'Pattern to export', pattern: 'test',
      successRate: 0.8, usageCount: 10, tags: ['test'], createdAt: new Date(), updatedAt: new Date(),
    });

    const exported = library.exportPatterns();
    expect(exported.length).toBe(1);

    const newLibrary = new PatternLibrary();
    newLibrary.importPatterns(exported);
    expect(newLibrary.size).toBe(1);
    expect(newLibrary.getPattern('p1')).toBeDefined();
  });
});
