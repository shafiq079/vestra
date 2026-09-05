import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Category, Collection, Product } from '../src/models';
import { seedCatalogue } from '../src/seed/catalogueSeed';

const app = createApp({ enableDiagnostics: false });

beforeEach(async () => { await seedCatalogue(); });
afterAll(async () => { await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Collection.deleteMany({})]); });

function expectProductDto(product: Record<string, unknown>) {
  expect(product).toEqual(expect.objectContaining({ id: expect.any(String), slug: expect.any(String),
    name: expect.any(String), price: expect.any(Number), variants: expect.any(Array), createdAt: expect.any(String) }));
  expect(product).not.toHaveProperty('_id');
  expect(product).not.toHaveProperty('__v');
}

describe('GET /api/products', () => {
  it('returns exact pagination metadata and page boundaries', async () => {
    const first = await request(app).get('/api/products?page=1&pageSize=10').expect(200);
    expect(first.body).toMatchObject({ total: 24, page: 1, pageSize: 10, totalPages: 3 });
    expect(first.body.items).toHaveLength(10);
    expectProductDto(first.body.items[0]);
    expect((await request(app).get('/api/products?page=3&pageSize=10')).body.items).toHaveLength(4);
    const beyond = await request(app).get('/api/products?page=4&pageSize=10').expect(200);
    expect(beyond.body).toMatchObject({ items: [], total: 24, totalPages: 3 });
    const empty = await request(app).get('/api/products?category=missing&page=1&pageSize=10').expect(200);
    expect(empty.body).toEqual({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  });

  it.each([
    ['category=dresses', 'category', 'dresses'], ['genderCollection=men', 'genderCollection', 'men'],
    ['collection=autumn-edit', 'collection', 'autumn-edit'], ['tryOnEligible=true', 'tryOnEligible', true],
  ])('supports compatibility array mode for %s', async (query, field, value) => {
    const response = await request(app).get(`/api/products?${query}`).expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every((item: Record<string, unknown>) => item[field] === value)).toBe(true);
  });

  it('accepts bracket/repeated arrays and all scalar catalogue filters', async () => {
    const arrays = await request(app).get('/api/products?category[]=dresses&category[]=outerwear&size[]=M&size[]=L&colour[]=Black&colour[]=Navy').expect(200);
    expect(arrays.body.length).toBeGreaterThan(0);
    expect(arrays.body.every((item: { category: string }) => ['dresses', 'outerwear'].includes(item.category))).toBe(true);
    const filters = ['brand[]=VESTRA', 'fit[]=relaxed', 'rating=4', 'availability=true', 'onSale=true',
      'sizeRecEligible=true', 'genderCollection=women', 'search=dress'];
    for (const filter of filters) {
      const result = await request(app).get(`/api/products?${filter}`).expect(200);
      expect(Array.isArray(result.body)).toBe(true);
    }
  });

  it('uses effective sale price for ranges and combined filters', async () => {
    const response = await request(app).get('/api/products?minPrice=260&maxPrice=265&onSale=true&category=outerwear').expect(200);
    expect(response.body.map((item: { slug: string }) => item.slug)).toContain('belted-trench-coat-stone');
  });

  it('uses variant stock, including the no-stock branch', async () => {
    const product = await Product.findOne({ isPublished: true });
    await Product.updateOne({ _id: product!._id }, { $set: { 'variants.$[].stock': 0 } });
    const unavailable = await request(app).get('/api/products?availability=false').expect(200);
    expect(unavailable.body.map((item: { id: string }) => item.id)).toContain(product!.id);
    const available = await request(app).get('/api/products?availability=true').expect(200);
    expect(available.body.map((item: { id: string }) => item.id)).not.toContain(product!.id);
  });

  it.each(['recommended', 'newest', 'price_asc', 'price_desc', 'rating', 'bestselling'])('sorts %s deterministically', async (sortBy) => {
    const first = await request(app).get(`/api/products?sortBy=${sortBy}`).expect(200);
    const second = await request(app).get(`/api/products?sortBy=${sortBy}`).expect(200);
    expect(first.body.map((item: { id: string }) => item.id)).toEqual(second.body.map((item: { id: string }) => item.id));
    const effectivePrices = first.body.map((p: { price: number; salePrice?: number }) => p.salePrice ?? p.price);
    if (sortBy === 'price_asc') expect(effectivePrices).toEqual([...effectivePrices].sort((a, b) => a - b));
    if (sortBy === 'price_desc') expect(effectivePrices).toEqual([...effectivePrices].sort((a, b) => b - a));
    const values = first.body.map((p: { rating: number; reviewCount: number }) => sortBy === 'rating' ? p.rating : p.reviewCount);
    if (sortBy === 'rating' || sortBy === 'bestselling') expect(values).toEqual([...values].sort((a, b) => b - a));
    if (sortBy === 'newest') {
      const dates = first.body.map((p: { createdAt: string }) => Date.parse(p.createdAt));
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    }
  });
});

describe('special product endpoints', () => {
  it('returns featured, new, sale, search and slug responses', async () => {
    const featured = await request(app).get('/api/products/featured').expect(200);
    expect(featured.body.length).toBeLessThanOrEqual(8);
    expect(featured.body.every((p: { badges: string[] }) => p.badges.some((b) => ['new', 'bestseller'].includes(b)))).toBe(true);
    const newest = await request(app).get('/api/products/new').expect(200);
    expect(newest.body.length).toBeLessThanOrEqual(8);
    expect(newest.body.every((p: { badges: string[] }) => p.badges.includes('new'))).toBe(true);
    const sale = await request(app).get('/api/products/sale').expect(200);
    expect(sale.body.every((p: { price: number; salePrice: number }) => p.salePrice < p.price)).toBe(true);
    expect((await request(app).get('/api/products/search?q=silk').expect(200)).body.length).toBeGreaterThan(0);
    expectProductDto((await request(app).get('/api/products/silk-wrap-dress-midnight').expect(200)).body);
  });

  it('preserves related order, omits unpublished relations, and validates lookup', async () => {
    const source = await Product.findOne({ isPublished: true, 'relatedProductIds.0': { $exists: true } });
    const expected = source!.relatedProductIds.map(String);
    await Product.updateOne({ _id: expected[1] }, { isPublished: false });
    const response = await request(app).get(`/api/products/${source!.id}/related`).expect(200);
    expect(response.body.map((p: { id: string }) => p.id)).toEqual(expected.filter((id) => id !== expected[1]));
    await request(app).get('/api/products/not-an-id/related').expect(400);
    await request(app).get('/api/products/000000000000000000000000/related').expect(404);
  });

  it('makes an unpublished product unreachable through every public product access path', async () => {
    const hidden = await Product.findOne({ isPublished: true });
    hidden!.badges = ['new'];
    hidden!.salePrice = hidden!.price - 1;
    hidden!.isPublished = false;
    await hidden!.save();
    const paths = ['/api/products', '/api/products?search=' + encodeURIComponent(hidden!.name), '/api/products/featured',
      '/api/products/new', '/api/products/sale', '/api/products/search?q=' + encodeURIComponent(hidden!.name)];
    for (const path of paths) {
      const response = await request(app).get(path).expect(200);
      expect(response.body.map((p: { id: string }) => p.id)).not.toContain(hidden!.id);
    }
    await request(app).get(`/api/products/${hidden!.slug}`).expect(404);
    await request(app).get(`/api/products/${hidden!.id}/related`).expect(404);
  });
});

describe('query errors', () => {
  it.each(['page=0', 'page=-1', 'page=abc', 'pageSize=0', 'pageSize=101', 'genderCollection=kids',
    'sortBy=random', 'availability=yes', 'rating=6', 'minPrice=5&maxPrice=4'])('returns ApiError for %s', async (query) => {
    const response = await request(app).get(`/api/products?${query}`).expect(400);
    expect(response.body).toEqual({ code: 'BAD_REQUEST', message: 'Invalid catalogue query.', details: expect.any(Object) });
  });
  it('rejects missing and empty search text', async () => {
    await request(app).get('/api/products/search').expect(400);
    await request(app).get('/api/products/search?q=%20').expect(400);
  });
});

describe('category and collection endpoints', () => {
  it('lists active categories in display order and returns children and slug DTOs', async () => {
    const categories = await request(app).get('/api/categories').expect(200);
    expect(categories.body.map((c: { displayOrder: number }) => c.displayOrder)).toEqual([1, 2, 3, 4, 5, 6]);
    const women = categories.body.find((c: { slug: string }) => c.slug === 'women');
    const children = await request(app).get(`/api/categories?parentId=${women.id}`).expect(200);
    expect(children.body.map((c: { slug: string }) => c.slug)).toEqual(['dresses', 'tops']);
    const category = await request(app).get('/api/categories/dresses').expect(200);
    expect(category.body).toEqual(expect.objectContaining({ id: expect.any(String), parentId: women.id }));
    expect(category.body).not.toHaveProperty('_id');
  });
  it('excludes inactive categories and handles category errors', async () => {
    await Category.updateOne({ slug: 'dresses' }, { isActive: false });
    expect((await request(app).get('/api/categories').expect(200)).body.some((c: { slug: string }) => c.slug === 'dresses')).toBe(false);
    await request(app).get('/api/categories/dresses').expect(404);
    await request(app).get('/api/categories?parentId=bad').expect(400);
    await request(app).get('/api/categories/missing').expect(404);
  });
  it('lists deterministic active collections, supports slug DTOs, and excludes inactive ones', async () => {
    await Collection.updateOne({ slug: 'weekend-essentials' }, { isActive: false });
    const collections = await request(app).get('/api/collections').expect(200);
    expect(collections.body.map((c: { name: string }) => c.name)).toEqual(['Autumn Edit', 'The Workwear Edit']);
    const collection = await request(app).get('/api/collections/autumn-edit').expect(200);
    expect(collection.body).toEqual(expect.objectContaining({ id: expect.any(String), slug: 'autumn-edit' }));
    expect(collection.body).not.toHaveProperty('_id');
    await request(app).get('/api/collections/weekend-essentials').expect(404);
    await request(app).get('/api/collections/missing').expect(404);
  });
});
