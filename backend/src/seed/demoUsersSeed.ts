import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { MeasurementProfile, User } from '../models';

export interface DemoPasswords { customer: string; admin: string }
export async function seedDemoUsers(passwords: DemoPasswords): Promise<void> {
  const records = [
    { email: 'emma.thompson@example.co.uk', firstName: 'Emma', lastName: 'Thompson', role: 'customer' as const, password: passwords.customer,
      addresses: [{ label: 'Home', firstName: 'Emma', lastName: 'Thompson', line1: '42 Notting Hill Gate', line2: 'Flat 3', city: 'London', county: 'Greater London', postcode: 'W11 3HX', country: 'United Kingdom', isDefault: true }] },
    { email: 'admin@vestra.co.uk', firstName: 'Admin', lastName: 'User', role: 'admin' as const, password: passwords.admin, addresses: [] },
  ];
  for (const { password, ...record } of records) {
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    await User.findOneAndUpdate({ email: record.email }, { $set: { ...record, passwordHash, isActive: true, marketingOptIn: false } }, { upsert: true, runValidators: true });
  }
  const customer = await User.findOne({ email: records[0]!.email }).orFail();
  await MeasurementProfile.findOneAndUpdate({ userId: customer._id }, { $set: { height: 168, weight: 62, chest: 88, waist: 70, hips: 94, inseam: 76, ageRange: '25-34', bodyProfile: 'regular', preferredFit: 'regular', unitSystem: 'metric', lastUpdated: new Date() } }, { upsert: true, runValidators: true });
}

async function main(): Promise<void> {
  const missing = [!env.DEMO_CUSTOMER_PASSWORD && 'DEMO_CUSTOMER_PASSWORD', !env.DEMO_ADMIN_PASSWORD && 'DEMO_ADMIN_PASSWORD'].filter(Boolean);
  if (missing.length) throw new Error(`Missing required demo seed variables: ${missing.join(', ')}`);
  await connectDatabase(env.MONGODB_URI);
  try { await seedDemoUsers({ customer: env.DEMO_CUSTOMER_PASSWORD!, admin: env.DEMO_ADMIN_PASSWORD! }); process.stdout.write('Seeded demo customer and admin users.\n'); }
  finally { await disconnectDatabase(); }
}
if (require.main === module) main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : 'Demo user seed failed.'}\n`); process.exitCode = 1; });
