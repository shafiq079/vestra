/**
 * Minimal logger with a single secret-redaction choke point.
 *
 * Every log line the backend emits goes through here, so credentials that leak
 * into a driver error message (a MongoDB connection string, a bearer token) are
 * redacted in one place rather than at each call site.
 *
 * Silent under NODE_ENV=test so the test output stays readable — the assertions,
 * not the server chatter, are what matters there.
 */

type LogLevel = 'info' | 'warn' | 'error';

/** Patterns whose captured secret portion must never reach a log sink. */
const REDACTIONS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // mongodb://user:pass@host and mongodb+srv://user:pass@host
  { pattern: /\b(mongodb(?:\+srv)?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, replacement: '$1<redacted>:<redacted>@' },
  // Any other scheme carrying userinfo, e.g. https://user:pass@provider.example
  { pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, replacement: '$1<redacted>:<redacted>@' },
  // Authorization: Bearer <token>
  { pattern: /\b(bearer)\s+[\w-]+\.[\w-]+\.[\w-]+/gi, replacement: '$1 <redacted>' },
];

/** Replaces any credential-shaped substring with a redaction marker. */
export function redactSecrets(value: string): string {
  return REDACTIONS.reduce((acc, { pattern, replacement }) => acc.replace(pattern, replacement), value);
}

function isTestEnvironment(): boolean {
  // Read at call time rather than importing config/env, so the logger stays
  // usable from inside environment validation itself.
  return process.env.NODE_ENV === 'test';
}

function serialise(part: unknown): string {
  if (typeof part === 'string') return part;
  if (part instanceof Error) return `${part.name}: ${part.message}`;
  if (part === undefined) return 'undefined';
  try {
    return JSON.stringify(part) ?? String(part);
  } catch {
    return String(part);
  }
}

function emit(level: LogLevel, parts: unknown[]): void {
  if (isTestEnvironment()) return;
  const message = redactSecrets(parts.map(serialise).join(' '));
  const line = `[vestra-backend] ${new Date().toISOString()} ${level.toUpperCase()} ${message}`;

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info: (...parts: unknown[]): void => emit('info', parts),
  warn: (...parts: unknown[]): void => emit('warn', parts),
  error: (...parts: unknown[]): void => emit('error', parts),
};
