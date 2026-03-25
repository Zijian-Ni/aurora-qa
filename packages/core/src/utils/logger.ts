type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: Date;
  error?: Error;
}

export class Logger {
  private minLevel: LogLevel;
  private format: 'json' | 'pretty';
  private context: string;

  constructor(context = 'aurora', level: LogLevel = 'info', format: 'json' | 'pretty' = 'pretty') {
    this.context = context;
    this.minLevel = level;
    this.format = format;
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.minLevel, this.format);
  }

  private shouldLog(level: LogLevel): boolean {
    return (LEVELS[level] ?? 0) >= (LEVELS[this.minLevel] ?? 0);
  }

  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    if (this.format === 'json') {
      process.stderr.write(
        JSON.stringify({
          ts: entry.timestamp.toISOString(),
          level: entry.level,
          ctx: entry.context ?? this.context,
          msg: entry.message,
          ...(entry.data !== undefined ? { data: entry.data } : {}),
          ...(entry.error
            ? { error: entry.error.message, stack: entry.error.stack }
            : {}),
        }) + '\n',
      );
    } else {
      const color = COLORS[entry.level] ?? '';
      const ts = DIM + entry.timestamp.toISOString().replace('T', ' ').slice(0, 23) + RESET;
      const lvl = color + entry.level.toUpperCase().padEnd(5) + RESET;
      const ctx = DIM + `[${entry.context ?? this.context}]` + RESET;
      const msg = entry.message;

      let line = `${ts} ${lvl} ${ctx} ${msg}`;

      if (entry.data !== undefined) {
        line += ' ' + DIM + JSON.stringify(entry.data) + RESET;
      }
      if (entry.error) {
        line += '\n  ' + color + entry.error.stack + RESET;
      }

      process.stderr.write(line + '\n');
    }
  }

  debug(message: string, data?: unknown): void {
    this.write({ level: 'debug', message, data, timestamp: new Date() });
  }

  info(message: string, data?: unknown): void {
    this.write({ level: 'info', message, data, timestamp: new Date() });
  }

  warn(message: string, data?: unknown): void {
    this.write({ level: 'warn', message, data, timestamp: new Date() });
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    this.write({
      level: 'error',
      message,
      data,
      timestamp: new Date(),
      error: error instanceof Error ? error : undefined,
    });
  }

  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const ms = (performance.now() - start).toFixed(1);
      this.debug(`${label} completed`, { durationMs: ms });
    };
  }
}

export const logger = new Logger('aurora');
