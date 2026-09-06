import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { AdminAuditLog, Category, Product } from '../src/models';
import { CATALOGUE_COUNTS } from '../src/seed/catalogueSeed';
import { evaluatePromo, PROMO_RULES } from '../src/services/promoService';
import { productFixture } from './fixtures/models';
import { createTestUser, mintTestAccessToken } from './helpers/auth';

describe('admin bulk, category, inventory, promotion and CSV operations', () => {
  let token: string;
  beforeAll(async () => { token = mintTestAccessToken(await createTestUser({ email: 'management-admin@example.com', role: 'admin' })); });
  beforeEach(async () => { await Promise.all([Product.deleteMany({}), Category.deleteMany({}), AdminAuditLog.deleteMany({})]); });
  afterEach(() => vi.restoreAllMocks());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('bulk publishes atomically in request order', async () => {
    const [a,b] = await Product.create([productFixture({ slug: 'bulk-a', isPublished: false }), productFixture({ slug: 'bulk-b', isPublished: false })]);
    const ok = await request(app).post('/api/admin/products/bulk/publish').set(auth()).send({ ids: [b!.id,a!.id], isPublished: true });
    expect(ok.status).toBe(200); expect(ok.body.map((p: {id:string})=>p.id)).toEqual([b!.id,a!.id]);
    const missing = await request(app).post('/api/admin/products/bulk/publish').set(auth()).send({ ids: [a!.id,'000000000000000000000001'], isPublished: false });
    expect(missing.status).toBe(404); expect((await Product.findById(a!._id))!.isPublished).toBe(true);
  });

  it('bulk deletes atomically and cleans related references', async () => {
    const [a,b] = await Product.create([productFixture({ slug: 'delete-a' }), productFixture({ slug: 'delete-b' })]);
    const keeper = await Product.create(productFixture({ slug: 'keeper', relatedProductIds: [a!._id,b!._id] }));
    expect((await request(app).post('/api/admin/products/bulk/delete').set(auth()).send({ ids: [a!.id,'000000000000000000000001'] })).status).toBe(404);
    expect(await Product.countDocuments({ _id: { $in: [a!._id,b!._id] } })).toBe(2);
    const deleted = await request(app).post('/api/admin/products/bulk/delete').set(auth()).send({ ids: [a!.id,b!.id] });
    expect(deleted.body.deleted).toBe(2); expect((await Product.findById(keeper._id))!.relatedProductIds).toHaveLength(0);
    expect((await AdminAuditLog.findOne({ action: 'product.bulk_delete' }))?.metadata).toMatchObject({ count: 2 });
  });

  it('resets only products to the backend-owned seed catalogue', async () => {
    await Product.create(productFixture({ slug: 'temporary' }));
    const response = await request(app).post('/api/admin/products/reset').set(auth());
    expect(response.status).toBe(200); expect(response.body).toHaveLength(CATALOGUE_COUNTS.products);
    expect(await Product.exists({ slug: 'heritage-wool-coat-camel' })).toBeTruthy();
  });

  it('manages categories, cascades slug changes, and enforces references', async () => {
    const created = await request(app).post('/api/admin/categories').set(auth()).send({ name: 'Old', slug: 'old', displayOrder: 2, isActive: false });
    expect(created.status).toBe(201);
    await Product.create(productFixture({ category: 'old' }));
    expect((await request(app).put(`/api/admin/categories/${created.body.id}`).set(auth()).send({ slug: 'new' })).status).toBe(200);
    expect(await Product.exists({ category: 'new' })).toBeTruthy();
    expect((await request(app).delete(`/api/admin/categories/${created.body.id}`).set(auth())).status).toBe(409);
    expect((await request(app).post('/api/admin/categories').set(auth()).send({ name: 'Dup', slug: 'new' })).status).toBe(409);
    expect((await request(app).post('/api/admin/categories').set(auth()).send({ name: 'Bad parent', slug: 'bad-parent', parentId: '000000000000000000000001' })).status).toBe(400);
  });

  it('rejects self-parent and deletion of parents, but deletes unused categories', async () => {
    const parent = await Category.create({ name:'Parent',slug:'parent' }); const child = await Category.create({ name:'Child',slug:'child',parentId:parent._id });
    expect((await request(app).put(`/api/admin/categories/${parent.id}`).set(auth()).send({ parentId: parent.id })).status).toBe(400);
    expect((await request(app).delete(`/api/admin/categories/${parent.id}`).set(auth())).status).toBe(409);
    expect((await request(app).delete(`/api/admin/categories/${child.id}`).set(auth())).status).toBe(204);
  });

  it.each([[10,'in_stock'],[5,'low_stock'],[0,'out_of_stock']] as const)('updates one variant and derives %s as %s', async (stock,status) => {
    const product = await Product.create(productFixture({ isPublished:true, variants:[{sku:'TARGET',colour:'Black',colourHex:'#000',size:'M',stock:1},{sku:'OTHER',colour:'Blue',colourHex:'#00f',size:'L',stock:0}] }));
    const target=product.variants[0]!, other=product.variants[1]!;
    const response=await request(app).patch(`/api/admin/inventory/${product.id}/variants/${target.id}`).set(auth()).send({stock});
    expect(response.status).toBe(200); expect(response.body.variants[1].stock).toBe(other.stock); expect(response.body.stockStatus).toBe(status);
    expect((await request(app).get(`/api/products/${product.slug}`)).body.stockStatus).toBe(status);
  });

  it('validates inventory ids, missing resources, and stock numbers', async () => {
    const product=await Product.create(productFixture()); const variant=product.variants[0]!;
    expect((await request(app).patch(`/api/admin/inventory/bad/variants/${variant.id}`).set(auth()).send({stock:1})).status).toBe(400);
    expect((await request(app).patch(`/api/admin/inventory/${product.id}/variants/bad`).set(auth()).send({stock:1})).status).toBe(400);
    expect((await request(app).patch(`/api/admin/inventory/000000000000000000000001/variants/${variant.id}`).set(auth()).send({stock:1})).status).toBe(404);
    expect((await request(app).patch(`/api/admin/inventory/${product.id}/variants/000000000000000000000001`).set(auth()).send({stock:1})).status).toBe(404);
    expect((await request(app).patch(`/api/admin/inventory/${product.id}/variants/${variant.id}`).set(auth()).send({stock:-1})).status).toBe(400);
    expect((await request(app).patch(`/api/admin/inventory/${product.id}/variants/${variant.id}`).set(auth()).send({stock:1.5})).status).toBe(400);
  });

  it('represents the canonical functional promotion rules with numeric display limits', async () => {
    const response=await request(app).get('/api/admin/promotions').set(auth()); expect(response.status).toBe(200);
    for(const promotion of response.body){ const rule=PROMO_RULES[promotion.code]; expect(promotion).toMatchObject({discountType:'percentage',value:rule!.percentage,minimumSpend:rule!.minimumSpend,active:rule!.active}); expect(typeof promotion.usageLimit).toBe('number'); expect(evaluatePromo(promotion.code, Math.max(1000,rule!.minimumSpend)).valid).toBe(rule!.active); }
    expect(response.body.map((p:{code:string})=>p.code).sort()).toEqual(['AUTUMN15','VESTRA10','WELCOME']);
  });

  it('imports valid quoted CSV rows and reports invalid rows and booleans', async () => {
    const csv='name,slug,category,price,brand,genderCollection,shortDescription,isPublished,colour,colourHex,size,sku,stock\r\n"Coat, Fine",csv-coat,outerwear,90,VESTRA,women,"A ""fine"" coat",yes,Black,#000,M,CSV-1,3\r\nBad,bad,outerwear,no,VESTRA,kids,,maybe,Black,#000,M,CSV-2,-1\r\n';
    const response=await request(app).post('/api/admin/products/import').set(auth()).set('Content-Type','text/csv').send(csv);
    expect(response.status).toBe(201); expect(response.body).toMatchObject({totalRows:2,importedCount:1,errorCount:1}); expect(response.body.errors[0].row).toBe(3);
    expect(response.body.errors[0].errors.join(' ')).toMatch(/price|gender|stock|isPublished/i);
    expect((await request(app).get('/api/products/csv-coat')).status).toBe(200);
  });

  it('reports existing and within-file duplicate CSV identifiers', async () => {
    await Product.create(productFixture({slug:'existing',variants:[{sku:'EXISTING',colour:'Black',colourHex:'#000',size:'M',stock:1}]}));
    const csv='name,slug,category,price,brand,genderCollection,sku\nOne,existing,x,10,VESTRA,women,NEW\nTwo,new,x,10,VESTRA,women,EXISTING\nThree,same,x,10,VESTRA,women,SAME\nFour,same,x,10,VESTRA,women,SAME\n';
    const response=await request(app).post('/api/admin/products/import').set(auth()).set('Content-Type','text/csv').send(csv);
    expect(response.body).toMatchObject({totalRows:4,importedCount:1,errorCount:3});
    expect(response.body.errors.map((e:{row:number})=>e.row)).toEqual([2,3,5]);
  });

  it.each([
    ['missing required field','name,slug,category,price,brand,genderCollection\n,missing,x,10,VESTRA,women\n','name'],
    ['invalid price','name,slug,category,price,brand,genderCollection\nBad,bad-price,x,no,VESTRA,women\n','price'],
    ['invalid sale price','name,slug,category,price,brand,genderCollection,salePrice\nBad,bad-sale,x,10,VESTRA,women,10\n','sale'],
    ['invalid gender','name,slug,category,price,brand,genderCollection\nBad,bad-gender,x,10,VESTRA,kids\n','gender'],
    ['invalid stock','name,slug,category,price,brand,genderCollection,stock\nBad,bad-stock,x,10,VESTRA,women,1.5\n','stock'],
    ['invalid boolean','name,slug,category,price,brand,genderCollection,isPublished\nBad,bad-bool,x,10,VESTRA,women,maybe\n','isPublished'],
  ])('reports %s as a row-level CSV error',async(_label,csv,expected)=>{
    const response=await request(app).post('/api/admin/products/import').set(auth()).set('Content-Type','text/csv').send(csv);
    expect(response.body).toMatchObject({totalRows:1,importedCount:0,errorCount:1,errors:[{row:2}]}); expect(response.body.errors[0].errors.join(' ')).toMatch(new RegExp(expected,'i'));
  });

  it('rolls back the valid CSV batch when its database write unexpectedly fails', async () => {
    vi.spyOn(Product, 'insertMany').mockRejectedValueOnce(new Error('simulated write failure'));
    const csv='name,slug,category,price,brand,genderCollection\nOne,rollback-one,x,10,VESTRA,women\nTwo,rollback-two,x,20,VESTRA,men\n';
    const response=await request(app).post('/api/admin/products/import').set(auth()).set('Content-Type','text/csv').send(csv);
    expect(response.status).toBe(500); expect(await Product.countDocuments({slug:{$in:['rollback-one','rollback-two']}})).toBe(0);
  });
});
