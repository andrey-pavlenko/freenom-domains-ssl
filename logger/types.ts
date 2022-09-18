export const logLevels = ['all', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type Level = typeof logLevels[number];

export type ConfigureFn = (level: Level) => Promise<void>;

export interface Logger {
  trace(message: unknown, ...args: unknown[]): void;
  debug(message: unknown, ...args: unknown[]): void;
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
  fatal(message: unknown, ...args: unknown[]): void;
}
