import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AuthSession, Cart, Category, Collection, DeliveryOption, MeasurementProfile, Order,
  Product, Review, User, WishlistItem,
} from '../src/models';
import {
  cartFixture, categoryFixture, collectionFixture, deliveryOptionFixture,
  measurementProfileFixture, orderFixture, productFixture, reviewFixture,
  userFixture, wishlistItemFixture,
} from './fixtures/models';

beforeAll(async () => {
  await Promise.all([
    User, MeasurementProfile, Product, Category, Collection, Review,
    Cart, WishlistItem, Order, DeliveryOption, AuthSession,
  ].map((registeredModel) => registeredModel.syncIndexes()));
});

describe('Phase 2 models', () => {
  it('registers every model once', async () => {
    expect(Object.keys(mongoose.models).sort()).toEqual([
      'AuthSession', 'Cart', 'Category', 'Collection', 'DeliveryOption', 'MeasurementProfile',
      'Order', 'Product', 'Review', 'User', 'WishlistItem',
    ].sort());
    await expect(import('../src/models/index.js')).resolves.toBeDefined();
  });

  it('enforces required fields and enums', async () => {
    await expect(new User({}).validate()).rejects.toThrow();
    await expect(new Product(productFixture({ genderCollection: 'kids' })).validate()).rejects.toThrow();
    await expect(new Review(reviewFixture({ fitFeedback: 'perfect' })).validate()).rejects.toThrow();
    await expect(new Order(orderFixture({ status: 'shipped' })).validate()).rejects.toThrow();
  });

  it('validates MeasurementProfile enums and non-negative measurements', async () => {
    await expect(new MeasurementProfile(measurementProfileFixture()).validate()).resolves.toBeUndefined();
    await expect(new MeasurementProfile(measurementProfileFixture({ preferredFit: 'oversized' })).validate()).rejects.toThrow();
    await expect(new MeasurementProfile(measurementProfileFixture({ unitSystem: 'unknown' })).validate()).rejects.toThrow();
    await expect(new MeasurementProfile(measurementProfileFixture({ waist: -1 })).validate()).rejects.toThrow();
  });

  it('applies defaults', () => {
    const user = new User(userFixture());
    const product = new Product(productFixture());
    expect([user.role, user.isActive, product.isPublished, product.rating]).toEqual([
      'customer', true, false, 0,
    ]);
  });

  it('rejects invalid numbers and sale prices', async () => {
    await expect(new Product(productFixture({ price: -1 })).validate()).rejects.toThrow();
    await expect(new Product(productFixture({ salePrice: 101 })).validate()).rejects.toThrow();
    await expect(new Product(productFixture({
      variants: [{ sku: 'NEG', colour: 'Black', colourHex: '#000', size: 'M', stock: -1 }],
    })).validate()).rejects.toThrow();
    await expect(new Review(reviewFixture({ rating: 6 })).validate()).rejects.toThrow();
    await expect(new Cart(cartFixture({
      items: [{ productId: new mongoose.Types.ObjectId(), variantId: new mongoose.Types.ObjectId(),
        colour: 'Black', size: 'M', quantity: 0, price: 10 }],
    })).validate()).rejects.toThrow();
  });

  it('rejects duplicate normalized user emails', async () => {
    await User.create(userFixture({ email: 'DUP@example.com' }));
    await expect(User.create(userFixture({ email: 'dup@example.com' }))).rejects.toMatchObject({ code: 11000 });
  });
  it('rejects duplicate product slugs', async () => {
    await Product.create(productFixture({ slug: 'duplicate-product' }));
    await expect(Product.create(productFixture({ slug: 'duplicate-product' }))).rejects.toMatchObject({ code: 11000 });
  });
  it('rejects duplicate category slugs', async () => {
    await Category.create(categoryFixture({ slug: 'duplicate-category' }));
    await expect(Category.create(categoryFixture({ slug: 'duplicate-category' }))).rejects.toMatchObject({ code: 11000 });
  });
  it('rejects duplicate collection slugs', async () => {
    await Collection.create(collectionFixture({ slug: 'duplicate-collection' }));
    await expect(Collection.create(collectionFixture({ slug: 'duplicate-collection' }))).rejects.toMatchObject({ code: 11000 });
  });
  it('allows only one MeasurementProfile per user', async () => {
    const userId = new mongoose.Types.ObjectId();
    await MeasurementProfile.create(measurementProfileFixture({ userId }));
    await expect(MeasurementProfile.create(measurementProfileFixture({ userId }))).rejects.toMatchObject({ code: 11000 });
  });
  it('keeps WishlistItem unique by user and product', async () => {
    const item = wishlistItemFixture();
    await WishlistItem.create(item);
    await expect(WishlistItem.create(item)).rejects.toMatchObject({ code: 11000 });
  });

  it('does not persist derived User wishlistIds or measurementProfile fields', () => {
    const user = new User({ ...userFixture(), wishlistIds: [new mongoose.Types.ObjectId()], measurementProfile: {} });
    const json = user.toJSON() as Record<string, unknown>;
    expect(json).not.toHaveProperty('wishlistIds');
    expect(json).not.toHaveProperty('measurementProfile');
  });

  it('never serialises the persisted password hash', () => {
    const user = new User(userFixture());
    const json = user.toJSON() as Record<string, unknown>;

    expect(json).not.toHaveProperty('passwordHash');
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
    expect(json).toMatchObject({
      email: 'customer@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'customer',
    });
  });

  it('serialises top-level, embedded, reference, array, and date values', () => {
    const productId = new mongoose.Types.ObjectId();
    const relatedId = new mongoose.Types.ObjectId();
    const variantId = new mongoose.Types.ObjectId();
    const deliveryOptionId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const product = new Product(productFixture({
      relatedProductIds: [relatedId],
      images: [{ url: '/coat.jpg', alt: 'Coat', position: 0, isLifestyle: false }],
      variants: [{ _id: variantId, sku: 'SERIAL', colour: 'Black', colourHex: '#000', size: 'M', stock: 1 }],
    })).toJSON() as Record<string, any>;
    const category = new Category(categoryFixture({ parentId: productId })).toJSON() as Record<string, any>;
    const profile = new MeasurementProfile(measurementProfileFixture({ userId })).toJSON() as Record<string, any>;
    const review = new Review(reviewFixture({ productId, userId })).toJSON() as Record<string, any>;
    const cart = new Cart(cartFixture({ userId, deliveryOptionId, items: [{
      productId, variantId, colour: 'Black', size: 'M', quantity: 1, price: 100,
    }] })).toJSON() as Record<string, any>;
    const wishlist = new WishlistItem(wishlistItemFixture({ userId, productId })).toJSON() as Record<string, any>;
    const order = new Order(orderFixture({ userId, items: [{
      productId, productName: 'Coat', productImage: '/coat.jpg', brand: 'VESTRA',
      colour: 'Black', size: 'M', quantity: 1, price: 100,
    }] })).toJSON() as Record<string, any>;
    const user = new User(userFixture({ addresses: [{ label: 'Home', firstName: 'Ada',
      lastName: 'Lovelace', line1: '1 Road', city: 'London', postcode: 'SW1A 1AA', country: 'UK' }] })).toJSON() as Record<string, any>;

    expect(typeof user.id).toBe('string');
    expect(typeof user.addresses[0].id).toBe('string');
    expect(typeof product.images[0].id).toBe('string');
    expect(typeof product.variants[0].id).toBe('string');
    expect(product.relatedProductIds).toEqual([relatedId.toString()]);
    expect(category.parentId).toBe(productId.toString());
    expect(profile.userId).toBe(userId.toString());
    expect([review.productId, review.userId]).toEqual([productId.toString(), userId.toString()]);
    expect([cart.userId, cart.items[0].productId, cart.items[0].variantId, cart.deliveryOptionId])
      .toEqual([userId.toString(), productId.toString(), variantId.toString(), deliveryOptionId.toString()]);
    expect([wishlist.userId, wishlist.productId]).toEqual([userId.toString(), productId.toString()]);
    expect([order.userId, order.items[0].productId]).toEqual([userId.toString(), productId.toString()]);
    expect(typeof order.items[0].id).toBe('string');
    expect(typeof profile.lastUpdated).toBe('string');
    for (const json of [user, product, category, profile, review, cart, wishlist, order]) {
      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('__v');
    }
  });

  it('validates exclusive owner identities', async () => {
    await expect(new Cart(cartFixture({ userId: undefined, guestId: undefined })).validate()).rejects.toThrow();
    await expect(new Order(orderFixture({ guestEmail: 'guest@example.com' })).validate()).rejects.toThrow();
  });

  it('provides valid core factories', async () => {
    await expect(new Category(categoryFixture()).validate()).resolves.toBeUndefined();
    await expect(new Collection(collectionFixture()).validate()).resolves.toBeUndefined();
    await expect(new DeliveryOption(deliveryOptionFixture()).validate()).resolves.toBeUndefined();
  });
});
