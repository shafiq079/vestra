import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Category, Collection, Product } from '../src/models';
import { seedCatalogue } from '../src/seed/catalogueSeed';

const app = createApp({ enableDiagnostics: false });

beforeAll(async () => { await Product.createIndexes(); });
beforeEach(async () => { await seedCatalogue(); });
afterAll(async () => { await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Collection.deleteMany({})]); });

function expectProductDto(product: Record<string, unknown>) {
  expect(product).toEqual(expect.objectContaining({
    id: expect.any(String),
    slug: expect.any(String),
    name: expect.any(String),
    price: expect.any(Number),
    variants: expect.any(Array),
    createdAt: expect.any(String),
  }));
  expect(product).not.toHaveProperty('_id');
  expect(product).not.toHaveProperty('__v');
}

describe('catalogue core behaviour', () => {
  it('returns exact pagination metadata and page boundaries', async () => {
    const first = await request(app).get('/api/products?page=1&pageSize=10').expect(200);
    expect(first.body).toMatchObject({ total: 24, page: 1, pageSize: 10, totalPages: 3 });
    expect(first.body.items).toHaveLength(10);
    expectProductDto(first.body.items[0]);

    expect((await request(app).get('/api/products?page=3&pageSize=10')).body.items).toHaveLength(4);

    const beyond = await request(app).get('/api/products?page=4&pageSize=10').expect(200);
    expect(beyond.body).toMatchObject({ items: [], total: 24, totalPages: 3 });
  });

  it('accepts array and scalar catalogue filters', async () => {
    const arrays = await request(app)
      .get('/api/products?category[]=dresses&category[]=outerwear&size[]=M&size[]=L&colour[]=Black&colour[]=Navy')
      .expect(200);

    expect(arrays.body.length).toBeGreaterThan(0);
    expect(arrays.body.every((item: { category: string }) => ['dresses', 'outerwear'].includes(item.category))).toBe(true);

    for (const filter of [
      'brand[]=VESTRA',
      'fit[]=relaxed',
      'rating=4',
      'availability=true',
      'onSale=true',
      'sizeRecEligible=true',
      'genderCollection=women',
      'search=dress',
    ]) {
      const response = await request(app).get(`/api/products?${filter}`).expect(200);
      expect(Array.isArray(response.body)).toBe(true);
    }
  });

  it('returns featured, new, sale, search and slug responses', async () => {
    const featured = await request(app).get('/api/products/featured').expect(200);
    expect(featured.body.length).toBeLessThanOrEqual(8);

    const newest = await request(app).get('/api/products/new').expect(200);
    expect(newest.body.length).toBeLessThanOrEqual(8);
    expect(newest.body.every((product: { badges: string[] }) => product.badges.includes('new'))).toBe(true);

    const sale = await request(app).get('/api/products/sale').expect(200);
    expect(sale.body.every((product: { price: number; salePrice: number }) => product.salePrice < product.price)).toBe(true);

    expect((await request(app).get('/api/products/search?q=silk').expect(200)).body.length).toBeGreaterThan(0);
    expectProductDto((await request(app).get('/api/products/silk-wrap-dress-midnight').expect(200)).body);
  });

  it('keeps unpublished products out of every public product access path', async () => {
    const hidden = await Product.findOne({ isPublished: true });
    hidden!.badges = ['new'];
    hidden!.salePrice = hidden!.price - 1;
    hidden!.isPublished = false;
    await hidden!.save();

    for (const path of [
      '/api/products',
      '/api/products?search=' + encodeURIComponent(hidden!.name),
      '/api/products/featured',
      '/api/products/new',
      '/api/products/sale',
      '/api/products/search?q=' + encodeURIComponent(hidden!.name),
    ]) {
      const response = await request(app).get(path).expect(200);
      expect(response.body.map((product: { id: string }) => product.id)).not.toContain(hidden!.id);
    }

    await request(app).get(`/api/products/${hidden!.slug}`).expect(404);
    await request(app).get(`/api/products/${hidden!.id}/related`).expect(404);
  });

  it('serves active categories and collections with public DTOs', async () => {
    const categories = await request(app).get('/api/categories').expect(200);
    expect(categories.body.map((category: { displayOrder: number }) => category.displayOrder)).toEqual([1, 2, 3, 4, 5, 6]);

    const women = categories.body.find((category: { slug: string }) => category.slug === 'women');
    const children = await request(app).get(`/api/categories?parentId=${women.id}`).expect(200);
    expect(children.body.map((category: { slug: string }) => category.slug)).toEqual(['dresses', 'tops']);

    const category = await request(app).get('/api/categories/dresses').expect(200);
    expect(category.body).toEqual(expect.objectContaining({ id: expect.any(String), parentId: women.id }));
    expect(category.body).not.toHaveProperty('_id');

    const collections = await request(app).get('/api/collections').expect(200);
    expect(collections.body.map((collection: { name: string }) => collection.name)).toEqual([
      'Autumn Edit',
      'The Workwear Edit',
      'Weekend Essentials',
    ]);

    const collection = await request(app).get('/api/collections/autumn-edit').expect(200);
    expect(collection.body).toEqual(expect.objectContaining({ id: expect.any(String), slug: 'autumn-edit' }));
    expect(collection.body).not.toHaveProperty('_id');
  });
});
