import { Types } from 'mongoose';
import type {
  CartShape, CategoryShape, CollectionShape, DeliveryOptionShape, MeasurementProfileShape,
  OrderShape, ProductShape, ReviewShape, UserShape, WishlistItemShape,
} from '../../src/models';

type FixtureOverrides<T> = Partial<Record<keyof T, unknown>>;


export const objectId = (): Types.ObjectId => new Types.ObjectId();
export const userFixture = (overrides: FixtureOverrides<UserShape> = {}) => ({ email: 'customer@example.com', firstName: 'Ada', lastName: 'Lovelace', passwordHash: 'not-a-real-password-hash', ...overrides });
export const categoryFixture = (overrides: FixtureOverrides<CategoryShape> = {}) => ({ name: 'Dresses', slug: `dresses-${new Types.ObjectId()}`, isActive: true, displayOrder: 1, ...overrides });
export const collectionFixture = (overrides: FixtureOverrides<CollectionShape> = {}) => ({ name: 'Autumn Edit', slug: `autumn-${new Types.ObjectId()}`, description: 'Seasonal collection', image: '/autumn.jpg', ...overrides });
export const productFixture = (overrides: FixtureOverrides<ProductShape> = {}) => ({ slug: `product-${new Types.ObjectId()}`, name: 'Wool Coat', brand: 'VESTRA', shortDescription: 'A coat', fullDescription: 'A carefully tailored wool coat.', category: 'outerwear', genderCollection: 'women', price: 100, currency: 'GBP', images: [{ url: '/coat.jpg', alt: 'Coat', position: 0, isLifestyle: false }], variants: [{ sku: `SKU-${new Types.ObjectId()}`, colour: 'Black', colourHex: '#000000', size: 'M', stock: 2 }], fitDescription: 'Regular fit', ...overrides });
export const reviewFixture = (overrides: FixtureOverrides<ReviewShape> = {}) => ({ productId: objectId(), userId: objectId(), userName: 'Ada L.', rating: 5, title: 'Excellent', body: 'Excellent quality.', ...overrides });
export const cartFixture = (overrides: FixtureOverrides<CartShape> = {}) => ({ userId: objectId(), items: [{ productId: objectId(), variantId: objectId(), colour: 'Black', size: 'M', quantity: 1, price: 100 }], subtotal: 100, estimatedTotal: 100, ...overrides });
export const wishlistItemFixture = (overrides: FixtureOverrides<WishlistItemShape> = {}) => ({ userId: objectId(), productId: objectId(), ...overrides });
export const deliveryOptionFixture = (overrides: FixtureOverrides<DeliveryOptionShape> = {}) => ({ name: 'Standard', description: '3-5 days', price: 0, estimatedDays: '3-5 working days', ...overrides });
export const orderFixture = (overrides: FixtureOverrides<OrderShape> = {}) => ({ orderNumber: `VST-${new Types.ObjectId()}`, userId: objectId(), items: [{ productId: objectId(), productName: 'Wool Coat', productImage: '/coat.jpg', brand: 'VESTRA', colour: 'Black', size: 'M', quantity: 1, price: 100 }], shippingAddress: { label: 'Home', firstName: 'Ada', lastName: 'Lovelace', line1: '1 High Street', city: 'London', postcode: 'SW1A 1AA', country: 'United Kingdom' }, deliveryOption: deliveryOptionFixture(), subtotal: 100, deliveryCost: 0, total: 100, estimatedDelivery: '2026-09-05', ...overrides });
export const measurementProfileFixture = (overrides: FixtureOverrides<MeasurementProfileShape> = {}) => ({
  userId: objectId(),
  unitSystem: 'metric',
  height: 170,
  preferredFit: 'regular',
  ...overrides,
});
