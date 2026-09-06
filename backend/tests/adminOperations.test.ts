import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { Types } from 'mongoose';
import { MeasurementProfile, Order, Product, Review, User, WishlistItem } from '../src/models';
import { orderFixture, productFixture, reviewFixture } from './fixtures/models';
import { createTestUser, mintTestAccessToken } from './helpers/auth';

describe('admin dashboard, users, orders and reviews', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>; let token: string;
  beforeAll(async()=>{ admin=await createTestUser({email:'operations-admin@example.com',role:'admin'}); token=mintTestAccessToken(admin); });
  beforeEach(async()=>{ vi.useRealTimers(); await Promise.all([Order.deleteMany({}),Product.deleteMany({}),Review.deleteMany({}),WishlistItem.deleteMany({}),MeasurementProfile.deleteMany({}),User.deleteMany({_id:{$ne:admin._id}})]); });
  const auth=()=>({Authorization:`Bearer ${token}`});

  it('returns exact real UTC dashboard metrics and honest future-feature zeros', async()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    await User.create([{email:'new@example.com',firstName:'N',lastName:'C',passwordHash:'hash',role:'customer',createdAt:new Date('2026-09-03')},{email:'old@example.com',firstName:'O',lastName:'C',passwordHash:'hash',role:'customer',createdAt:new Date('2026-08-03')}]);
    await Product.create([productFixture({slug:'published',isPublished:true,stockStatus:'low_stock'}),productFixture({slug:'draft',isPublished:false,stockStatus:'in_stock'})]);
    await Order.create([{...orderFixture({orderNumber:'VST-CURRENT-1',paymentStatus:'paid',total:150}),createdAt:new Date('2026-09-02')},{...orderFixture({orderNumber:'VST-CURRENT-2',paymentStatus:'pending',total:999}),createdAt:new Date('2026-09-04')},{...orderFixture({orderNumber:'VST-PREVIOUS',paymentStatus:'paid',total:100}),createdAt:new Date('2026-08-04')}]);
    const response=await request(app).get('/api/admin/dashboard').set(auth());
    expect(Object.keys(response.body).sort()).toEqual(['avgOrderValue','customers','orders','products','revenue','sizeRecUsage','vtoUsage'].sort());
    expect(response.body).toEqual({revenue:{total:150,change:50,period:'September 2026'},orders:{total:2,change:100,period:'September 2026'},avgOrderValue:{total:150,change:50},customers:{total:2,newThisMonth:1},products:{total:2,published:1,lowStock:1},vtoUsage:{total:0,helpfulRate:0},sizeRecUsage:{total:0,successRate:0}});
  });

  it('handles dashboard zero denominators without non-finite JSON values',async()=>{
    const body=(await request(app).get('/api/admin/dashboard').set(auth())).body;
    expect(body.revenue.change).toBe(0); expect(body.orders.change).toBe(0); expect(body.avgOrderValue.change).toBe(0);
    expect(JSON.stringify(body)).not.toMatch(/NaN|Infinity/);
  });

  it('returns safe user DTOs with wishlist and measurement data and changes active state',async()=>{
    const user=await createTestUser({email:'managed@example.com'}); const product=await Product.create(productFixture());
    await WishlistItem.create({userId:user._id,productId:product._id}); await MeasurementProfile.create({userId:user._id,unitSystem:'metric',height:170});
    const body=(await request(app).get('/api/admin/users').set(auth())).body; const dto=body.find((u:{id:string})=>u.id===user.id);
    expect(dto).toMatchObject({id:user.id,wishlistIds:[product.id],measurementProfile:{userId:user.id,unitSystem:'metric',height:170}}); expect(dto.passwordHash).toBeUndefined();
    expect((await request(app).patch(`/api/admin/users/${user.id}/active`).set(auth()).send({isActive:false})).body.isActive).toBe(false);
    expect((await request(app).patch(`/api/admin/users/${admin.id}/active`).set(auth()).send({isActive:false})).status).toBe(409);
  });

  it('lists authenticated and guest orders newest first and controls lifecycle only',async()=>{
    const customer=await createTestUser({email:'order-customer@example.com'});
    const older=await Order.create({...orderFixture({orderNumber:'VST-OLD',userId:customer._id,status:'pending',paymentStatus:'paid'}),createdAt:new Date('2026-01-01')});
    const guestData=orderFixture({orderNumber:'VST-NEW',userId:undefined,guestEmail:'guest@example.com',status:'confirmed',paymentStatus:'paid'}); delete (guestData as {userId?:unknown}).userId;
    const newer=await Order.create({...guestData,createdAt:new Date('2026-02-01')});
    const list=(await request(app).get('/api/admin/orders').set(auth())).body; expect(list.map((o:{id:string})=>o.id)).toEqual([newer.id,older.id]);
    const same=await request(app).patch(`/api/admin/orders/${older.id}/status`).set(auth()).send({status:'pending'}); expect(same.status).toBe(200);
    const changed=await request(app).patch(`/api/admin/orders/${older.id}/status`).set(auth()).send({status:'confirmed'}); expect(changed.body).toMatchObject({status:'confirmed',paymentStatus:'paid'});
    expect((await request(app).patch(`/api/admin/orders/${older.id}/status`).set(auth()).send({status:'delivered'})).status).toBe(409);
  });

  it('lists every review state and restricts moderation fields',async()=>{
    const [pending,approved,reported]=await Review.create([reviewFixture({title:'Pending'}),reviewFixture({productId:new Types.ObjectId(),userId:new Types.ObjectId(),title:'Approved',isApproved:true}),reviewFixture({productId:new Types.ObjectId(),userId:new Types.ObjectId(),title:'Reported',isReported:true})]);
    const list=(await request(app).get('/api/admin/reviews').set(auth())).body; expect(list).toHaveLength(3); expect(list[0].id).toBe(reported!.id);
    expect((await request(app).patch(`/api/admin/reviews/${pending!.id}/moderation`).set(auth()).send({isApproved:true,isReported:true})).body).toMatchObject({isApproved:true,isReported:true,title:'Pending'});
    expect((await request(app).patch(`/api/admin/reviews/${pending!.id}/moderation`).set(auth()).send({isApproved:false,isReported:false})).body).toMatchObject({isApproved:false,isReported:false});
    expect((await request(app).patch(`/api/admin/reviews/${approved!.id}/moderation`).set(auth()).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/admin/reviews/${approved!.id}/moderation`).set(auth()).send({rating:1,body:'changed',userId:admin.id})).status).toBe(400);
  });
});
