/**
 * Central developer logging. Errors are never swallowed silently: they are
 * recorded here (visible in the debug overlay) and printed to the console.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  scope: string;
  message: string;
  time: number;
}

const records: LogRecord[] = [];
const MAX = 200;
let errorCount = 0;

function push(level: LogLevel, scope: string, message: string, extra?: unknown): void {
  records.push({ level, scope, message, time: Date.now() });
  if (records.length > MAX) records.shift();
  if (level === 'error') errorCount++;
  const line = `[${scope}] ${message}`;
  if (level === 'error') console.error(line, extra ?? '');
  else if (level === 'warn') console.warn(line, extra ?? '');
  else if (level === 'info' && import.meta.env?.DEV) console.info(line);
}

export const log = {
  debug: (scope: string, msg: string) => push('debug', scope, msg),
  info: (scope: string, msg: string) => push('info', scope, msg),
  warn: (scope: string, msg: string, extra?: unknown) => push('warn', scope, msg, extra),
  error: (scope: string, msg: string, extra?: unknown) => push('error', scope, msg, extra),
  records: (): readonly LogRecord[] => records,
  errorCount: () => errorCount,
};
