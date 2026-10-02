export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

export class ClientLogger {
  private level: LogLevel;
  private context?: string;

  constructor(context?: string, defaultLevel?: LogLevel) {
    this.context = context;
    if (defaultLevel) {
      this.level = defaultLevel;
    } else {
      this.level = import.meta.env.DEV ? 'debug' : 'warn';
    }
  }

  public setLevel(level: LogLevel): void {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
    }
  }

  public child(childContext: string): ClientLogger {
    const combinedContext = this.context ? `${this.context}:${childContext}` : childContext;
    return new ClientLogger(combinedContext, this.level);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  public debug(message: string, ...meta: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    const prefix = this.context ? `[${this.context}]` : '';
    console.debug(`%c${prefix} ${message}`, 'color: #38bdf8', ...meta);
  }

  public info(message: string, ...meta: unknown[]): void {
    if (!this.shouldLog('info')) return;
    const prefix = this.context ? `[${this.context}]` : '';
    console.info(`%c${prefix} ${message}`, 'color: #4ade80', ...meta);
  }

  public warn(message: string, ...meta: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    const prefix = this.context ? `[${this.context}]` : '';
    console.warn(`%c${prefix} ${message}`, 'color: #facc15', ...meta);
  }

  public error(message: string, ...meta: unknown[]): void {
    if (!this.shouldLog('error')) return;
    const prefix = this.context ? `[${this.context}]` : '';
    console.error(`${prefix} ${message}`, ...meta);
  }
}

export const logger = new ClientLogger();
