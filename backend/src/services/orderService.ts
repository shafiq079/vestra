import mongoose, { type ClientSession } from 'mongoose';
import { Cart, Order, Product } from '../models';
import type { CheckoutInput } from '../validators/order';
import { HttpError, isHttpError } from '../utils/httpError';
import type { CartOwner } from './cartService';
import { calculateCartTotals } from './cartTotals';
import { deliveryCost, estimatedDelivery, resolveDeliveryOption } from './deliveryService';
import { deriveStockStatus } from './inventoryService';
import * as orderNumbers from './orderNumberService';

const ownerFilter = (owner: CartOwner) => 'userId' in owner ? { userId: owner.userId } : { guestId: owner.guestId };
const ORDER_NUMBER_ATTEMPTS = 3;
const primaryImage = (images: Array<{ url: string; position: number }>) =>
  [...images].sort((a, b) => a.position - b.position || a.url.localeCompare(b.url))[0]?.url ?? '';
const money = (n: number) => Number(n.toFixed(2));

function dto(order: InstanceType<typeof Order>) {
  const value = order.toObject();
  return { id: order.id, orderNumber: value.orderNumber,
    ...(value.userId ? { userId: value.userId.toString() } : {}), ...(value.guestEmail ? { guestEmail: value.guestEmail } : {}),
    items: value.items.map((item) => ({ id: item._id.toString(), productId: item.productId.toString(), productName: item.productName,
      productImage: item.productImage, brand: item.brand, colour: item.colour, size: item.size, quantity: item.quantity, price: item.price })),
    shippingAddress: { id: (order.shippingAddress as typeof order.shippingAddress & { id: string }).id, label: value.shippingAddress.label, firstName: value.shippingAddress.firstName,
      lastName: value.shippingAddress.lastName, line1: value.shippingAddress.line1, ...(value.shippingAddress.line2 ? { line2: value.shippingAddress.line2 } : {}),
      city: value.shippingAddress.city, ...(value.shippingAddress.county ? { county: value.shippingAddress.county } : {}), postcode: value.shippingAddress.postcode,
      country: value.shippingAddress.country, isDefault: value.shippingAddress.isDefault },
    deliveryOption: { id: (value.deliveryOption as typeof value.deliveryOption & { deliveryId?: string }).deliveryId ?? '', name: value.deliveryOption.name,
      description: value.deliveryOption.description, price: value.deliveryOption.price, estimatedDays: value.deliveryOption.estimatedDays },
    subtotal: value.subtotal, discount: value.discount, deliveryCost: value.deliveryCost, total: value.total,
    ...(value.promoCode ? { promoCode: value.promoCode } : {}), status: value.status, paymentStatus: value.paymentStatus,
    createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString(), estimatedDelivery: value.estimatedDelivery };
}

async function transact(owner: CartOwner, input: CheckoutInput, session: ClientSession) {
  const option = resolveDeliveryOption(input.deliveryOption.id);
  const cart = await Cart.findOne(ownerFilter(owner)).session(session);
  if (!cart || cart.items.length === 0) throw HttpError.conflict('The cart is missing or empty.');
  const products = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) }, isPublished: true }).session(session);
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = cart.items.map((item) => {
    const product = byId.get(item.productId.toString());
    if (!product) throw HttpError.conflict('A cart product is no longer available.');
    const variant = product.variants.id(item.variantId);
    if (!variant) throw HttpError.conflict('A cart variant is no longer available.');
    if (variant.stock < item.quantity) throw HttpError.conflict('Insufficient stock for a cart item.');
    return { item, product, variant, price: product.salePrice ?? product.price };
  });
  const totals = calculateCartTotals(lines.map((line) => ({ price: line.price, quantity: line.item.quantity })), cart.promoCode ?? undefined);
  const cost = deliveryCost(option, totals.subtotal);
  const items = lines.map(({ item, product, variant, price }) => ({ productId: product._id, productName: product.name,
    productImage: variant.image || primaryImage(product.images), brand: product.brand, colour: variant.colour,
    size: variant.size, quantity: item.quantity, price }));
  const grouped = new Set(lines.map(({ product }) => product.id));
  for (const id of grouped) {
    const product = byId.get(id)!;
    for (const line of lines.filter((candidate) => candidate.product.id === id)) line.variant.stock -= line.item.quantity;
    product.stockStatus = deriveStockStatus(product.variants.map((variant) => variant.stock));
    await product.save({ session });
  }
  const address = { ...input.shippingAddress, label: input.shippingAddress.label ?? 'Shipping', isDefault: input.shippingAddress.isDefault ?? false };
  delete (address as { id?: string }).id;
  const [order] = await Order.create([{ orderNumber: orderNumbers.generateOrderNumber(), ...('userId' in owner ? { userId: owner.userId } : { guestEmail: input.guestEmail }),
    items, shippingAddress: address, deliveryOption: { deliveryId: option.id, name: option.name, description: option.description, price: option.price, estimatedDays: option.estimatedDays },
    subtotal: totals.subtotal, discount: totals.discount, deliveryCost: cost, total: money(Math.max(0, totals.subtotal - totals.discount + cost)),
    ...(totals.promo.valid && cart.promoCode ? { promoCode: cart.promoCode } : {}), status: 'confirmed', paymentStatus: 'paid', estimatedDelivery: estimatedDelivery(option) }], { session });
  await Cart.deleteOne({ _id: cart._id }, { session });
  return order!;
}

export async function createOrder(owner: CartOwner, input: CheckoutInput) {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt += 1) {
      let created: InstanceType<typeof Order> | undefined;
      try {
        // A duplicate-key write aborts a MongoDB transaction, so each fresh number is
        // attempted in a fresh transaction while the bounded retry remains within checkout.
        await session.withTransaction(async () => { created = await transact(owner, input, session); });
        if (!created) throw new Error('Transaction did not create an order');
        return dto(created);
      } catch (error) {
        if (isOrderNumberCollision(error)) {
          if (attempt < ORDER_NUMBER_ATTEMPTS) continue;
          throw HttpError.conflict('A unique order number could not be allocated. Please try again.');
        }
        throw error;
      }
    }
    throw new Error('Order number retry loop ended unexpectedly');
  } catch (error) {
    if (isHttpError(error)) throw error;
    const labelled = error as { hasErrorLabel?: (label: string) => boolean; code?: number };
    if (labelled.code === 112 || labelled.hasErrorLabel?.('TransientTransactionError')) throw HttpError.conflict('Inventory changed during checkout. Please try again.');
    throw error;
  } finally { await session.endSession(); }
}

function isOrderNumberCollision(error: unknown): boolean {
  const duplicate = error as { code?: number; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  return duplicate?.code === 11000 &&
    (duplicate.keyPattern?.orderNumber !== undefined || duplicate.keyValue?.orderNumber !== undefined);
}

export async function listOrders(userId: string) { return Promise.all((await Order.find({ userId }).sort({ createdAt: -1 })).map(dto)); }
export async function getOrder(userId: string, orderId: string) {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw HttpError.notFound('Order not found.');
  return dto(order);
}
