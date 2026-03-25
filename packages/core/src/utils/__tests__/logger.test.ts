import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../logger.js';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger = new Logger('test', 'debug', 'pretty');
  });

  it('should log debug messages', () => {
    logger.debug('test debug');
    expect(process.stderr.write).toHaveBeenCalled();
  });

  it('should log info messages', () => {
    logger.info('test info');
    expect(process.stderr.write).toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    logger.warn('test warn');
    expect(process.stderr.write).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    logger.error('test error', new Error('test'));
    expect(process.stderr.write).toHaveBeenCalled();
  });

  it('should respect log level filtering', () => {
    const warnLogger = new Logger('test', 'warn', 'pretty');
    vi.spyOn(process.stderr, 'write').mockClear();
    warnLogger.debug('should not appear');
    warnLogger.info('should not appear');
    expect(process.stderr.write).not.toHaveBeenCalled();
    warnLogger.warn('should appear');
    expect(process.stderr.write).toHaveBeenCalled();
  });

  it('should create child loggers with context', () => {
    const child = logger.child('sub');
    child.info('child message');
    const call = (process.stderr.write as ReturnType<typeof vi.fn>).mock.calls.pop();
    expect(call?.[0]).toContain('test:sub');
  });

  it('should format as JSON', () => {
    const jsonLogger = new Logger('test', 'debug', 'json');
    jsonLogger.info('json test', { key: 'value' });
    const call = (process.stderr.write as ReturnType<typeof vi.fn>).mock.calls.pop();
    const output = call?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.msg).toBe('json test');
    expect(parsed.data.key).toBe('value');
  });

  it('should time operations', () => {
    const done = logger.time('operation');
    done();
    expect(process.stderr.write).toHaveBeenCalled();
  });
});
