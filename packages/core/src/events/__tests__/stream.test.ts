import { describe, it, expect, beforeEach } from 'vitest';
import { EventStream } from '../stream.js';

describe('EventStream', () => {
  let stream: EventStream;

  beforeEach(() => {
    stream = new EventStream(10);
  });

  it('should publish events and auto-assign id/timestamp', () => {
    const event = stream.publish({ type: 'test', payload: { msg: 'hello' }, source: 'unit-test' });
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.type).toBe('test');
  });

  it('should deliver events to subscribers', () => {
    const received: unknown[] = [];
    stream.subscribe(e => received.push(e));
    stream.publish({ type: 'a', payload: 1, source: 'test' });
    stream.publish({ type: 'b', payload: 2, source: 'test' });
    expect(received).toHaveLength(2);
  });

  it('should filter events in subscribe', () => {
    const received: unknown[] = [];
    stream.subscribe(e => received.push(e), e => e.type === 'important');
    stream.publish({ type: 'noise', payload: null, source: 'test' });
    stream.publish({ type: 'important', payload: 'yes', source: 'test' });
    expect(received).toHaveLength(1);
  });

  it('should unsubscribe', () => {
    const received: unknown[] = [];
    const unsub = stream.subscribe(e => received.push(e));
    stream.publish({ type: 'a', payload: 1, source: 'test' });
    unsub();
    stream.publish({ type: 'b', payload: 2, source: 'test' });
    expect(received).toHaveLength(1);
  });

  it('should maintain circular buffer', () => {
    for (let i = 0; i < 15; i++) {
      stream.publish({ type: 'event', payload: i, source: 'test' });
    }
    expect(stream.bufferSize).toBe(10);
    const last5 = stream.getBuffer(5);
    expect(last5).toHaveLength(5);
  });

  it('should clear buffer', () => {
    stream.publish({ type: 'a', payload: null, source: 'test' });
    expect(stream.bufferSize).toBe(1);
    stream.clearBuffer();
    expect(stream.bufferSize).toBe(0);
  });
});
