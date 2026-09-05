import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { AuthSession, MeasurementProfile, User, WishlistItem } from '../src/models';
import { seedDemoUsers } from '../src/seed/demoUsersSeed';
import { authHeader, createTestUser, loginTestUser, mintTestAccessToken } from './helpers/auth';

beforeEach(async () => { await Promise.all([AuthSession.deleteMany({}), MeasurementProfile.deleteMany({}), WishlistItem.deleteMany({}), User.deleteMany({})]); });
const registration = { firstName: ' Emma ', lastName: ' Thompson ', email: 'EMMA.THOMPSON@EXAMPLE.CO.UK', password: 'SecurePass123!', marketingOptIn: true };
const address = { label: 'Home', firstName: 'Emma', lastName: 'Thompson', line1: '1 High Street', city: 'London', postcode: 'sw1a 1aa', country: 'United Kingdom', isDefault: false };

describe('Phase 4 authentication', () => {
  it('registers a normalized customer with hashed password and top-level tokens', async () => {
    const response = await request(app).post('/api/auth/register').send({ ...registration, role: 'admin' });
    expect(response.status).toBe(400);
    const ok = await request(app).post('/api/auth/register').send(registration);
    expect(ok.status).toBe(201); expect(ok.body).toMatchObject({ email: registration.email.toLowerCase(), firstName: 'Emma', role: 'customer', marketingOptIn: true });
    expect(ok.body.token).toEqual(expect.any(String)); expect(ok.body.refreshToken).toEqual(expect.any(String)); expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash|SecurePass123|tokenHash/);
    const stored = await User.findOne({ email: registration.email.toLowerCase() }).select('+passwordHash').orFail();
    expect(stored.passwordHash).not.toBe(registration.password); expect(await bcrypt.compare(registration.password, stored.passwordHash)).toBe(true);
  });
  it('rejects invalid and duplicate registrations', async () => {
    await request(app).post('/api/auth/register').send(registration);
    expect((await request(app).post('/api/auth/register').send({ ...registration, email: registration.email.toLowerCase() })).status).toBe(409);
    expect((await request(app).post('/api/auth/register').send({ ...registration, password: 'short' })).status).toBe(400);
  });
  it('uses one generic login failure and supports case-insensitive success', async () => {
    const user = await createTestUser();
    for (const body of [{ email: user.email, password: 'wrong-password' }, { email: 'absent@example.com', password: 'wrong-password' }]) {
      const response = await request(app).post('/api/auth/login').send(body); expect(response.status).toBe(401); expect(response.body.code).toBe('INVALID_CREDENTIALS');
    }
    user.isActive = false; await user.save(); expect((await loginTestUser()).body.code).toBe('INVALID_CREDENTIALS'); user.isActive = true; await user.save();
    const ok = await loginTestUser('PHASE4@EXAMPLE.COM'); expect(ok.status).toBe(200); expect(ok.body).toHaveProperty('token');
  });
  it('protects me and enforces compatibility-route ownership', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'bearer bad')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authHeader(`${token}x`))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authHeader(token))).body.id).toBe(user.id);
    expect((await request(app).get(`/api/auth/me/${user.id}`).set(authHeader(token))).status).toBe(200);
    expect((await request(app).get(`/api/auth/me/${new User()._id}`).set(authHeader(token))).status).toBe(403);
  });
  it('rotates refresh tokens once and logs out idempotently', async () => {
    await createTestUser(); const login = await loginTestUser(); const old = login.body.refreshToken;
    const session = await AuthSession.findOne().orFail(); expect(session.tokenHash).not.toBe(old);
    const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: old }); expect(rotated.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: old })).status).toBe(401);
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: rotated.body.refreshToken })).status).toBe(204);
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: rotated.body.refreshToken })).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken })).status).toBe(401);
  });
  it('returns identical forgot-password acknowledgement without enumeration', async () => {
    await createTestUser(); const a = await request(app).post('/api/auth/forgot-password').send({ email: 'phase4@example.com' }); const b = await request(app).post('/api/auth/forgot-password').send({ email: 'absent@example.com' });
    expect(a.body).toEqual(b.body); expect(a.status).toBe(200); expect((await request(app).post('/api/auth/forgot-password').send({ email: 'bad' })).status).toBe(400);
  });
});

describe('Phase 4 profile', () => {
  it('updates allowlisted profile fields and rejects sensitive fields', async () => { const user = await createTestUser(); const h = authHeader(mintTestAccessToken(user)); expect((await request(app).patch('/api/profile').set(h).send({ firstName: 'Ada', marketingOptIn: true })).body).toMatchObject({ firstName: 'Ada', marketingOptIn: true }); for (const field of ['email', 'role', 'isActive', 'passwordHash', 'wishlistIds']) expect((await request(app).patch('/api/profile').set(h).send({ [field]: 'bad' })).status).toBe(400); });
  it('maintains exactly one default address and reassigns deterministically', async () => { const user = await createTestUser(); const h = authHeader(mintTestAccessToken(user)); const first = await request(app).post('/api/profile/addresses').set(h).send(address); expect(first.body.addresses[0].isDefault).toBe(true); const second = await request(app).post('/api/profile/addresses').set(h).send({ ...address, label: 'Work' }); const secondId = second.body.addresses[1].id; const changed = await request(app).patch(`/api/profile/addresses/${secondId}/default`).set(h); expect(changed.body.addresses.filter((a: {isDefault:boolean}) => a.isDefault)).toHaveLength(1); const removed = await request(app).delete(`/api/profile/addresses/${secondId}`).set(h); expect(removed.body.addresses[0].isDefault).toBe(true); expect((await request(app).patch('/api/profile/addresses/bad').set(h).send({ city: 'York' })).status).toBe(400); });
  it('upserts partial measurement profiles and controls identity/time', async () => { const user = await createTestUser(); const h = authHeader(mintTestAccessToken(user)); expect((await request(app).get('/api/profile/measurement-profile').set(h)).body).toBeNull(); expect((await request(app).patch('/api/profile/measurement-profile').set(h).send({ height: 168 })).status).toBe(400); const created = await request(app).patch('/api/profile/measurement-profile').set(h).send({ unitSystem: 'metric', height: 168 }); expect(created.body.userId).toBe(user.id); const updated = await request(app).patch('/api/profile/measurement-profile').set(h).send({ waist: 70 }); expect(updated.body).toMatchObject({ height: 168, waist: 70 }); expect((await request(app).patch('/api/profile/measurement-profile').set(h).send({ userId: new User().id })).status).toBe(400); });
  it('seeds exact demo identities idempotently and both authenticate', async () => { await seedDemoUsers({ customer: 'DemoCustomer123!', admin: 'DemoAdmin123!' }); await seedDemoUsers({ customer: 'DemoCustomer123!', admin: 'DemoAdmin123!' }); expect(await User.countDocuments()).toBe(2); expect((await request(app).post('/api/auth/login').send({ email: 'emma.thompson@example.co.uk', password: 'DemoCustomer123!' })).body.role).toBe('customer'); expect((await request(app).post('/api/auth/login').send({ email: 'admin@vestra.co.uk', password: 'DemoAdmin123!' })).body.role).toBe('admin'); });
});
