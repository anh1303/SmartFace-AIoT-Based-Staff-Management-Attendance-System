export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const COLOR_RESET = '\x1b[0m';
const COLOR_GRAY = '\x1b[90m';
const COLOR_CYAN = '\x1b[36m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RED = '\x1b[31m';
const COLOR_MAGENTA = '\x1b[35m';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLOR_CYAN,
  info: COLOR_GREEN,
  warn: COLOR_YELLOW,
  error: COLOR_RED,
  silent: COLOR_GRAY,
};

export class Logger {
  private level: LogLevel;
  private context?: string;
  private isJson: boolean;

  constructor(context?: string, defaultLevel?: LogLevel) {
    this.context = context;
    this.level = defaultLevel || this.resolveDefaultLevel();
    this.isJson = process.env.LOG_FORMAT === 'json';
  }

  private resolveDefaultLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
      return envLevel;
    }
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'test') return 'error';
    if (nodeEnv === 'production') return 'info';
    return 'debug';
  }

  public setLevel(level: LogLevel): void {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
    }
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public child(childContext: string): Logger {
    const combinedContext = this.context ? `${this.context}:${childContext}` : childContext;
    return new Logger(combinedContext, this.level);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatTimestamp(): string {
    const now = new Date();
    const iso = now.toISOString(); // e.g. 2026-10-02T10:30:00.123Z
    return iso.replace('T', ' ').replace('Z', '');
  }

  private log(level: LogLevel, message: string, ...meta: unknown[]): void {
    if (!this.shouldLog(level)) return;

    if (this.isJson) {
      const logPayload = {
        timestamp: new Date().toISOString(),
        level,
        context: this.context || undefined,
        message,
        meta: meta.length > 0 ? (meta.length === 1 ? meta[0] : meta) : undefined,
      };
      const jsonStr = JSON.stringify(logPayload);
      if (level === 'error') {
        console.error(jsonStr);
      } else if (level === 'warn') {
        console.warn(jsonStr);
      } else {
        console.log(jsonStr);
      }
      return;
    }

    const timestamp = `${COLOR_GRAY}[${this.formatTimestamp()}]${COLOR_RESET}`;
    const levelColor = LEVEL_COLORS[level] || COLOR_RESET;
    const levelBadge = `${levelColor}${level.toUpperCase().padEnd(5)}${COLOR_RESET}`;
    const contextBadge = this.context ? `${COLOR_MAGENTA}[${this.context}]${COLOR_RESET} ` : '';

    const formattedMessage = `${timestamp} ${levelBadge} ${contextBadge}${message}`;

    if (level === 'error') {
      if (meta.length > 0) {
        console.error(formattedMessage, ...meta);
      } else {
        console.error(formattedMessage);
      }
    } else if (level === 'warn') {
      if (meta.length > 0) {
        console.warn(formattedMessage, ...meta);
      } else {
        console.warn(formattedMessage);
      }
    } else {
      if (meta.length > 0) {
        console.log(formattedMessage, ...meta);
      } else {
        console.log(formattedMessage);
      }
    }
  }

  public debug(message: string, ...meta: unknown[]): void {
    this.log('debug', message, ...meta);
  }

  public info(message: string, ...meta: unknown[]): void {
    this.log('info', message, ...meta);
  }

  public warn(message: string, ...meta: unknown[]): void {
    this.log('warn', message, ...meta);
  }

  public error(message: string, ...meta: unknown[]): void {
    this.log('error', message, ...meta);
  }
}

export const logger = new Logger();
