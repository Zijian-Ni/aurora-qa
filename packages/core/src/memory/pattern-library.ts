import type { TestPattern } from '../types/index.js';

export class PatternLibrary {
  private patterns: Map<string, TestPattern> = new Map();

  addPattern(pattern: TestPattern): void {
    this.patterns.set(pattern.id, { ...pattern, updatedAt: new Date() });
  }

  matchPattern(context: { description?: string; tags?: string[] }): TestPattern | null {
    let bestMatch: TestPattern | null = null;
    let bestScore = 0;

    for (const pattern of this.patterns.values()) {
      let score = 0;

      if (context.description) {
        const descWords = context.description.toLowerCase().split(/\s+/);
        const patternWords = pattern.description.toLowerCase().split(/\s+/);
        const overlap = descWords.filter(w => patternWords.includes(w)).length;
        score += overlap / Math.max(descWords.length, 1);
      }

      if (context.tags && context.tags.length > 0) {
        const tagOverlap = context.tags.filter(t => pattern.tags.includes(t)).length;
        score += tagOverlap / context.tags.length;
      }

      // Weight by success rate
      score *= pattern.successRate;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestMatch;
  }

  updatePatternSuccess(patternId: string, success: boolean): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    pattern.usageCount++;
    // Exponential moving average
    const alpha = 0.1;
    pattern.successRate = pattern.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    pattern.updatedAt = new Date();
  }

  getTopPatterns(n = 10): TestPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.successRate * b.usageCount - a.successRate * a.usageCount)
      .slice(0, n);
  }

  getPattern(id: string): TestPattern | undefined {
    return this.patterns.get(id);
  }

  removePattern(id: string): boolean {
    return this.patterns.delete(id);
  }

  exportPatterns(): TestPattern[] {
    return Array.from(this.patterns.values());
  }

  importPatterns(patterns: TestPattern[]): void {
    for (const p of patterns) {
      this.patterns.set(p.id, p);
    }
  }

  get size(): number {
    return this.patterns.size;
  }

  clear(): void {
    this.patterns.clear();
  }
}
