export class WorkingMemory {
  private context: Map<string, unknown> = new Map();

  setContext(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  getContext<T = unknown>(key: string): T | undefined {
    return this.context.get(key) as T | undefined;
  }

  getFullContext(): Record<string, unknown> {
    return Object.fromEntries(this.context);
  }

  has(key: string): boolean {
    return this.context.has(key);
  }

  delete(key: string): boolean {
    return this.context.delete(key);
  }

  clear(): void {
    this.context.clear();
  }

  snapshot(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(Object.fromEntries(this.context)));
  }

  restore(snapshot: Record<string, unknown>): void {
    this.context.clear();
    for (const [k, v] of Object.entries(snapshot)) {
      this.context.set(k, v);
    }
  }

  get size(): number {
    return this.context.size;
  }

  keys(): string[] {
    return Array.from(this.context.keys());
  }
}
