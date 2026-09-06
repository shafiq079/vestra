import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const adminAuditLogSchema = new Schema({
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  action: { type: String, required: true, trim: true, immutable: true },
  entityType: { type: String, required: true, trim: true, immutable: true },
  entityId: { type: Schema.Types.ObjectId, immutable: true },
  metadata: { type: Schema.Types.Mixed, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
adminAuditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export type AdminAuditLogShape = InferSchemaType<typeof adminAuditLogSchema>;
export const AdminAuditLog: Model<AdminAuditLogShape> =
  (models.AdminAuditLog as Model<AdminAuditLogShape> | undefined) ?? model('AdminAuditLog', adminAuditLogSchema);
