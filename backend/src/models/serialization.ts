import { Types, type Schema } from 'mongoose';

function normalise(value: unknown, omittedFields: ReadonlySet<string>): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map((item) => normalise(item, omittedFields));
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (key === '__v' || omittedFields.has(key)) continue;
      if (key === '_id') {
        result.id = String(child);
      } else {
        result[key] = normalise(child, omittedFields);
      }
    }
    return result;
  }
  return value;
}

interface FrontendJsonOptions {
  /** Persistence-only fields that must never appear in frontend-shaped JSON. */
  omit?: readonly string[];
}

/** Applies the frontend's id/date JSON contract to a document and all subdocuments. */
export function frontendJson(schema: Schema, options: FrontendJsonOptions = {}): void {
  const omittedFields = new Set(options.omit ?? []);
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_document, returned: Record<string, unknown>) =>
      normalise(returned, omittedFields),
  });
}
