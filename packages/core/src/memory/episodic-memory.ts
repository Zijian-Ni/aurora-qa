import type { Episode } from '../types/index.js';
import { VectorStore } from './vector-store.js';
import type { MemoryEntry } from '../types/index.js';

export class EpisodicMemory {
  private store: VectorStore;

  constructor(options: { maxEntries?: number; persistPath?: string } = {}) {
    this.store = new VectorStore({
      maxEntries: options.maxEntries ?? 10_000,
      persistPath: options.persistPath,
    });
  }

  store_episode(episode: Episode): void {
    const content = [
      `Type: ${episode.type}`,
      `Outcome: ${episode.outcome}`,
      `Tags: ${episode.tags.join(', ')}`,
      episode.content,
    ].join('\n');

    this.store.upsert({
      id: episode.id,
      type: 'code-insight',
      content,
      metadata: {
        episodeType: episode.type,
        outcome: episode.outcome,
        tags: episode.tags,
        ...episode.metadata,
      },
      tags: [...episode.tags, episode.type, episode.outcome],
      createdAt: episode.timestamp,
      lastAccessedAt: episode.timestamp,
      accessCount: 0,
    });
  }

  recall(query: string, k = 5): Array<{ episode: Episode; score: number }> {
    const results = this.store.search(query, { limit: k * 2, minSimilarity: 0.1 });
    const now = Date.now();

    return results
      .map(r => {
        const age = now - new Date(r.entry.createdAt).getTime();
        const dayAge = age / (1000 * 60 * 60 * 24);
        const recencyWeight = Math.exp(-dayAge / 30); // 30-day half-life
        const score = r.similarity * recencyWeight;

        return {
          episode: this.entryToEpisode(r.entry),
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  forget(id: string): boolean {
    return this.store.delete(id);
  }

  getPatterns(): Array<{ pattern: string; count: number; avgScore: number }> {
    const all = this.store.all();
    const tagCounts = new Map<string, { count: number; totalAccess: number }>();

    for (const entry of all) {
      for (const tag of entry.tags) {
        const existing = tagCounts.get(tag) ?? { count: 0, totalAccess: 0 };
        existing.count++;
        existing.totalAccess += entry.accessCount;
        tagCounts.set(tag, existing);
      }
    }

    return Array.from(tagCounts.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([pattern, v]) => ({
        pattern,
        count: v.count,
        avgScore: v.totalAccess / v.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  stats(): { totalEpisodes: number; avgRelevanceScore: number; topPatterns: string[]; oldestEpisode: Date | null } {
    const all = this.store.all();
    const avgAccess = all.length > 0
      ? all.reduce((sum, e) => sum + e.accessCount, 0) / all.length
      : 0;

    const patterns = this.getPatterns();
    const oldest = all.length > 0
      ? new Date(Math.min(...all.map(e => new Date(e.createdAt).getTime())))
      : null;

    return {
      totalEpisodes: all.length,
      avgRelevanceScore: avgAccess,
      topPatterns: patterns.slice(0, 5).map(p => p.pattern),
      oldestEpisode: oldest,
    };
  }

  pruneOld(maxAgeDays: number): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const all = this.store.all();
    let pruned = 0;

    for (const entry of all) {
      if (new Date(entry.createdAt).getTime() < cutoff) {
        this.store.delete(entry.id);
        pruned++;
      }
    }
    return pruned;
  }

  flush(): void {
    this.store.flush();
  }

  get size(): number {
    return this.store.size;
  }

  private entryToEpisode(entry: MemoryEntry): Episode {
    return {
      id: entry.id,
      type: (entry.metadata['episodeType'] as string) ?? 'unknown',
      content: entry.content,
      tags: entry.tags,
      outcome: (entry.metadata['outcome'] as Episode['outcome']) ?? 'unknown',
      timestamp: new Date(entry.createdAt),
      metadata: entry.metadata,
    };
  }
}
