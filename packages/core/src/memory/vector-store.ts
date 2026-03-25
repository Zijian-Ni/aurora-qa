import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { MemoryEntry, MemoryEntryType, VectorSearchResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ─── TF-IDF Vector Engine ─────────────────────────────────────────────────────

/**
 * Lightweight TF-IDF vectorizer for semantic similarity without external APIs.
 * Produces dense-ish sparse vectors over a shared vocabulary.
 */
class TFIDFVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentFreq: Map<string, number> = new Map();
  private totalDocs = 0;
  private vocabSize = 0;

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
      .flatMap(t => this.ngrams(t));
  }

  private ngrams(token: string, n = 1): string[] {
    if (token.length <= 4 || n === 1) return [token];
    const grams: string[] = [token];
    for (let i = 0; i <= token.length - n; i++) {
      grams.push(token.slice(i, i + n));
    }
    return grams;
  }

  fit(texts: string[]): void {
    this.documentFreq.clear();
    this.totalDocs = texts.length;

    for (const text of texts) {
      const uniqueTokens = new Set(this.tokenize(text));
      for (const token of uniqueTokens) {
        this.documentFreq.set(token, (this.documentFreq.get(token) ?? 0) + 1);
      }
    }

    // Build vocabulary from tokens appearing in ≥2 docs or ≥1 if small corpus
    const minFreq = texts.length > 50 ? 2 : 1;
    this.vocabulary.clear();
    this.vocabSize = 0;
    for (const [token, freq] of this.documentFreq) {
      if (freq >= minFreq) {
        this.vocabulary.set(token, this.vocabSize++);
      }
    }

    // Compute IDF
    this.idf.clear();
    for (const [token, df] of this.documentFreq) {
      this.idf.set(token, Math.log((this.totalDocs + 1) / (df + 1)) + 1);
    }
  }

  transform(text: string): number[] {
    if (this.vocabSize === 0) return [];

    const tokens = this.tokenize(text);
    const tf: Map<string, number> = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    const vector = new Array<number>(this.vocabSize).fill(0);
    for (const [token, count] of tf) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        const idfScore = this.idf.get(token) ?? 1;
        vector[idx] = (count / tokens.length) * idfScore;
      }
    }

    return this.l2normalize(vector);
  }

  private l2normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    if (norm === 0) return v;
    return v.map(x => x / norm);
  }

  get size(): number {
    return this.vocabSize;
  }

  serialize(): object {
    return {
      vocabulary: Object.fromEntries(this.vocabulary),
      idf: Object.fromEntries(this.idf),
      documentFreq: Object.fromEntries(this.documentFreq),
      totalDocs: this.totalDocs,
      vocabSize: this.vocabSize,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.vocabulary = new Map(Object.entries(data['vocabulary'] as Record<string, number>));
    this.idf = new Map(Object.entries(data['idf'] as Record<string, number>));
    this.documentFreq = new Map(
      Object.entries(data['documentFreq'] as Record<string, number>),
    );
    this.totalDocs = data['totalDocs'] as number;
    this.vocabSize = data['vocabSize'] as number;
  }
}

// ─── VectorStore ──────────────────────────────────────────────────────────────

export interface VectorStoreOptions {
  maxEntries?: number;
  persistPath?: string;
  rebuildThreshold?: number;
}

export class VectorStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private vectorizer = new TFIDFVectorizer();
  private isDirty = false;
  private addedSinceRebuild = 0;

  private readonly maxEntries: number;
  private readonly persistPath?: string;
  private readonly rebuildThreshold: number;

  constructor(options: VectorStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? 50_000;
    this.persistPath = options.persistPath;
    this.rebuildThreshold = options.rebuildThreshold ?? 200;

    if (this.persistPath && existsSync(this.persistPath)) {
      this.load();
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  upsert(entry: Omit<MemoryEntry, 'vector'>): MemoryEntry {
    const vector = this.vectorizer.transform(entry.content);
    const full: MemoryEntry = { ...entry, vector };
    this.entries.set(entry.id, full);
    this.addedSinceRebuild++;
    this.isDirty = true;

    if (this.addedSinceRebuild >= this.rebuildThreshold) {
      this.rebuildVectors();
    }

    this.evictIfNeeded();
    return full;
  }

  search(
    query: string,
    {
      type,
      tags,
      limit = 10,
      minSimilarity = 0,
    }: {
      type?: MemoryEntryType;
      tags?: string[];
      limit?: number;
      minSimilarity?: number;
    } = {},
  ): VectorSearchResult[] {
    if (this.entries.size === 0) return [];

    const queryVector = this.vectorizer.transform(query);

    if (queryVector.length === 0) {
      // Fallback: return recent entries
      return Array.from(this.entries.values())
        .filter(e => !type || e.type === type)
        .slice(-limit)
        .map(e => ({ entry: e, similarity: 0 }));
    }

    const results: VectorSearchResult[] = [];

    for (const entry of this.entries.values()) {
      if (type && entry.type !== type) continue;
      if (tags && tags.length > 0 && !tags.some(t => entry.tags.includes(t))) continue;

      const similarity = this.cosine(queryVector, entry.vector);
      if (similarity >= minSimilarity) {
        results.push({ entry, similarity });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(r => {
        // Update access tracking
        const entry = r.entry;
        entry.accessCount++;
        entry.lastAccessedAt = new Date();
        return r;
      });
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) this.isDirty = true;
    return deleted;
  }

  clear(): void {
    this.entries.clear();
    this.vectorizer = new TFIDFVectorizer();
    this.isDirty = true;
    this.addedSinceRebuild = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  all(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  flush(): void {
    if (!this.persistPath || !this.isDirty) return;
    try {
      const data = {
        entries: Array.from(this.entries.values()),
        vectorizer: this.vectorizer.serialize(),
      };
      writeFileSync(this.persistPath, JSON.stringify(data), 'utf8');
      this.isDirty = false;
      logger.debug(`VectorStore flushed to ${this.persistPath}`, { size: this.entries.size });
    } catch (err) {
      logger.error('Failed to persist VectorStore', err);
    }
  }

  private load(): void {
    try {
      const raw = readFileSync(this.persistPath!, 'utf8');
      const data = JSON.parse(raw) as {
        entries: MemoryEntry[];
        vectorizer: Record<string, unknown>;
      };
      this.entries = new Map(data.entries.map(e => [e.id, e]));
      this.vectorizer.deserialize(data.vectorizer);
      logger.info(`VectorStore loaded`, { path: this.persistPath, size: this.entries.size });
    } catch (err) {
      logger.warn('Failed to load VectorStore from disk, starting fresh', { err });
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private rebuildVectors(): void {
    const all = Array.from(this.entries.values());
    if (all.length === 0) return;

    this.vectorizer.fit(all.map(e => e.content));
    for (const entry of all) {
      entry.vector = this.vectorizer.transform(entry.content);
    }
    this.addedSinceRebuild = 0;
    logger.debug(`VectorStore rebuilt vectors`, { entries: all.length });
  }

  private evictIfNeeded(): void {
    if (this.entries.size <= this.maxEntries) return;

    // Evict least recently accessed entries
    const sorted = Array.from(this.entries.values()).sort(
      (a, b) =>
        a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime() ||
        a.accessCount - b.accessCount,
    );
    const toEvict = sorted.slice(0, Math.floor(this.maxEntries * 0.1));
    for (const e of toEvict) {
      this.entries.delete(e.id);
    }
    logger.debug(`VectorStore evicted ${toEvict.length} entries`);
  }

  private cosine(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
    }
    // Vectors are pre-normalized, so dot product = cosine similarity
    return Math.max(0, Math.min(1, dot));
  }
}
