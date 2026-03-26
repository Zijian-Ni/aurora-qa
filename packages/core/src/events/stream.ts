import { EventEmitter } from 'node:events';
import type { Writable } from 'node:stream';
import type { AuroraEvent } from '../types/index.js';

type EventFilter = (event: AuroraEvent) => boolean;

export class EventStream extends EventEmitter {
  private buffer: AuroraEvent[] = [];
  private maxBuffer: number;

  constructor(maxBuffer = 100) {
    super();
    this.maxBuffer = maxBuffer;
  }

  override emit(type: string, event?: AuroraEvent | unknown): boolean {
    if (type === 'event' && event && typeof event === 'object' && 'id' in (event as object)) {
      const auroraEvent = event as AuroraEvent;
      this.buffer.push(auroraEvent);
      if (this.buffer.length > this.maxBuffer) {
        this.buffer = this.buffer.slice(-this.maxBuffer);
      }
    }
    return super.emit(type, event);
  }

  publish(event: Omit<AuroraEvent, 'id' | 'timestamp'>): AuroraEvent {
    const full: AuroraEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };
    this.emit('event', full);
    return full;
  }

  subscribe(handler: (event: AuroraEvent) => void, filter?: EventFilter): () => void {
    const wrappedHandler = (event: AuroraEvent) => {
      if (!filter || filter(event)) {
        handler(event);
      }
    };
    this.on('event', wrappedHandler);
    return () => this.off('event', wrappedHandler);
  }

  pipe(writeStream: Writable): () => void {
    const handler = (event: AuroraEvent) => {
      const sseData = `data: ${JSON.stringify(event)}\n\n`;
      writeStream.write(sseData);
    };
    this.on('event', handler);
    return () => this.off('event', handler);
  }

  async *toAsyncIterator(filter?: EventFilter): AsyncGenerator<AuroraEvent> {
    const queue: AuroraEvent[] = [];
    let resolve: (() => void) | null = null;

    const handler = (event: AuroraEvent) => {
      if (!filter || filter(event)) {
        queue.push(event);
        const r = resolve;
        resolve = null;
        r?.();
      }
    };

    this.on('event', handler);

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>(r => { resolve = r; });
          resolve = null;
        }
      }
    } finally {
      this.off('event', handler);
    }
  }

  getBuffer(n?: number): AuroraEvent[] {
    if (n) return this.buffer.slice(-n);
    return [...this.buffer];
  }

  clearBuffer(): void {
    this.buffer = [];
  }

  get bufferSize(): number {
    return this.buffer.length;
  }
}
