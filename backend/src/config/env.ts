/**
 * Validated environment loading.
 *
 * Fails fast with a clear, actionable message when a required variable is
 * missing or malformed — and never prints the offending value. Variables that
 * can carry a credential are listed in SENSITIVE_KEYS and reported by name
 * only, so a bad MONGODB_URI produces a useful error without leaking the URI.
 *
 * Every other module imports the frozen `env` object rather than reading
 * `process.env` directly, so there is exactly one place where configuration
 * enters the application.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Loads backend/.env when the process is started from the backend package root
// (which is what every npm script here does). dotenv never overwrites a value
// already present in process.env, so an explicitly-exported variable — or the
// test harness's own configuration — always wins over the file.
dotenv.config({ quiet: true });

/**
 * Variables whose value must never appear in an error message or log line.
 * Validation failures for these are reported by NAME ONLY.
 */
export const SENSITIVE_KEYS = new Set([
  'MONGODB_URI', 'JWT_SECRET', 'DEMO_CUSTOMER_PASSWORD', 'DEMO_ADMIN_PASSWORD',
]);

const MONGODB_URI_SCHEMES = ['mongodb://', 'mongodb+srv://'] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // 5000 matches the frontend default base URL (http://localhost:5000/api).
  PORT: z.coerce.number().int().positive().max(65535).default(5000),

  MONGODB_URI: z
    .string()
    .trim()
    .min(1)
    .refine((value) => MONGODB_URI_SCHEMES.some((scheme) => value.startsWith(scheme)), {
      message: 'must be a mongodb:// or mongodb+srv:// connection string',
    }),

  // Comma-separated list of permitted browser origins.
  CORS_ORIGIN: z.string().trim().min(1).default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  DEMO_CUSTOMER_PASSWORD: z.string().min(8).max(128).optional(),
  DEMO_ADMIN_PASSWORD: z.string().min(8).max(128).optional(),
});

export type NodeEnvironment = z.infer<typeof envSchema>['NODE_ENV'];

export interface AppEnvironment {
  readonly NODE_ENV: NodeEnvironment;
  readonly PORT: number;
  readonly MONGODB_URI: string;
  /** Raw CORS_ORIGIN value, as supplied. */
  readonly CORS_ORIGIN: string;
  readonly JWT_SECRET: string;
  readonly JWT_ACCESS_TTL_SECONDS: number;
  readonly BCRYPT_ROUNDS: number;
  readonly REFRESH_TOKEN_TTL_DAYS: number;
  readonly DEMO_CUSTOMER_PASSWORD?: string;
  readonly DEMO_ADMIN_PASSWORD?: string;
  /** CORS_ORIGIN split into individual origins. */
  readonly corsOrigins: readonly string[];
  readonly isProduction: boolean;
  readonly isTest: boolean;
}

/** Builds a failure message that names the invalid variables but never their values. */
function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const key = typeof issue.path[0] === 'string' ? issue.path[0] : '(root)';
    return SENSITIVE_KEYS.has(key)
      ? `  - ${key}: missing or invalid (value withheld)`
      : `  - ${key}: ${issue.message}`;
  });

  return [
    'Invalid backend environment configuration:',
    ...lines,
    '',
    'See backend/.env.example for the required variable names and their purpose.',
  ].join('\n');
}

function loadEnvironment(): AppEnvironment {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(formatIssues(parsed.error));
  }

  const { NODE_ENV, PORT, MONGODB_URI, CORS_ORIGIN, ...auth } = parsed.data;

  const corsOrigins = CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (corsOrigins.length === 0) {
    throw new Error(
      'Invalid backend environment configuration:\n  - CORS_ORIGIN: must list at least one origin',
    );
  }

  // A wildcard origin in production would expose the API to every site on the
  // web, so it is rejected outright rather than merely discouraged.
  if (NODE_ENV === 'production' && corsOrigins.includes('*')) {
    throw new Error(
      'Invalid backend environment configuration:\n  - CORS_ORIGIN: a wildcard "*" origin is not permitted when NODE_ENV=production',
    );
  }

  return Object.freeze({
    NODE_ENV,
    PORT,
    MONGODB_URI,
    CORS_ORIGIN,
    JWT_SECRET: auth.JWT_SECRET,
    JWT_ACCESS_TTL_SECONDS: auth.JWT_ACCESS_TTL_SECONDS,
    BCRYPT_ROUNDS: auth.BCRYPT_ROUNDS,
    REFRESH_TOKEN_TTL_DAYS: auth.REFRESH_TOKEN_TTL_DAYS,
    ...(auth.DEMO_CUSTOMER_PASSWORD ? { DEMO_CUSTOMER_PASSWORD: auth.DEMO_CUSTOMER_PASSWORD } : {}),
    ...(auth.DEMO_ADMIN_PASSWORD ? { DEMO_ADMIN_PASSWORD: auth.DEMO_ADMIN_PASSWORD } : {}),
    corsOrigins: Object.freeze(corsOrigins),
    isProduction: NODE_ENV === 'production',
    isTest: NODE_ENV === 'test',
  });
}

export const env: AppEnvironment = loadEnvironment();
