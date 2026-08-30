import { Types, type Schema } from 'mongoose';

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (key === '__v') continue;
      if (key === '_id') {
        result.id = String(child);
      } else {
        result[key] = normalise(child);
      }
    }
    return result;
  }
  return value;
}

/** Applies the frontend's id/date JSON contract to a document and all subdocuments. */
export function frontendJson(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_document, returned: Record<string, unknown>) => normalise(returned),
  });
}
