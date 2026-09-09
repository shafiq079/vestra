import { Cart, Product } from '../models';
import type { AddCartItemInput } from '../validators/cart';
import { HttpError } from '../utils/httpError';
import { evaluatePromo, type PromoResult } from './promoService';
import { calculateCartTotals } from './cartTotals';

export type CartOwner = { userId: string; guestId?: never } | { guestId: string; userId?: never };
const ownerFilter = (owner: CartOwner) => 'userId' in owner ? { userId: owner.userId } : { guestId: owner.guestId };

async function currentItems(cart: InstanceType<typeof Cart>) {
  const products = await Product.find({ _id: { $in: cart.items.map((item) => item.productId) }, isPublished: true });
  const byId = new Map(products.map((product) => [product.id, product]));
  return cart.items.map((item) => {
    const product = byId.get(item.productId.toString());
    if (!product) throw HttpError.conflict('A cart item is no longer available.');
    const variant = product.variants.id(item.variantId);
    if (!variant) throw HttpError.conflict('A cart variant is no longer available.');
    if (variant.stock < item.quantity) throw HttpError.conflict('A cart item exceeds current stock.');
    item.colour = variant.colour; item.size = variant.size; item.price = product.salePrice ?? product.price;
    return { item, product, variant };
  });
}

async function recalculate(cart: InstanceType<typeof Cart>) {
  const resolved = await currentItems(cart);
  const totals = calculateCartTotals(resolved.map(({ item }) => item), cart.promoCode ?? undefined);
  cart.subtotal = totals.subtotal;
  const { promo } = totals;
  if (cart.promoCode && !promo.valid) cart.promoCode = null;
  cart.discount = totals.discount;
  cart.estimatedTotal = totals.estimatedTotal;
  await cart.save();
  return { resolved, promo };
}

async function dto(cart: InstanceType<typeof Cart>) {
  const { resolved } = await recalculate(cart);
  return { items: resolved.map(({ item, product }) => ({ id: item.id, productId: product.id,
    product: product.toJSON(), variantId: item.variantId.toString(), colour: item.colour,
    size: item.size, quantity: item.quantity, price: item.price })), subtotal: cart.subtotal,
  discount: cart.discount, ...(cart.promoCode ? { promoCode: cart.promoCode } : {}), estimatedTotal: cart.estimatedTotal };
}
const emptyDto = () => ({ items: [], subtotal: 0, discount: 0, estimatedTotal: 0 });

export async function getCart(owner: CartOwner) {
  const cart = await Cart.findOne(ownerFilter(owner)); return cart ? dto(cart) : emptyDto();
}
async function ownedCart(owner: CartOwner) {
  return Cart.findOneAndUpdate(ownerFilter(owner), { $setOnInsert: ownerFilter(owner) }, { new: true, upsert: true, setDefaultsOnInsert: true });
}
async function resolveSelection(input: AddCartItemInput) {
  const product = await Product.findOne({ _id: input.productId, isPublished: true });
  if (!product) throw HttpError.notFound('Product not found.');
  const variant = product.variants.id(input.variantId);
  if (!variant) throw HttpError.badRequest('Variant does not belong to this product.');
  if (variant.colour !== input.colour || variant.size !== input.size) throw HttpError.badRequest('Colour or size does not match the selected variant.');
  if (variant.stock === 0) throw HttpError.conflict('The selected variant is out of stock.');
  return { product, variant };
}
export async function addItem(owner: CartOwner, input: AddCartItemInput) {
  const { product, variant } = await resolveSelection(input); const cart = await ownedCart(owner);
  const existing = cart.items.find((item) => item.productId.equals(product._id) && item.variantId.equals(variant._id));
  const resulting = (existing?.quantity ?? 0) + input.quantity;
  if (resulting > variant.stock) throw HttpError.conflict('Requested quantity exceeds current stock.');
  if (existing) existing.quantity = resulting;
  else cart.items.push({ productId: product._id, variantId: variant._id, colour: variant.colour,
    size: variant.size, quantity: input.quantity, price: product.salePrice ?? product.price });
  return dto(cart);
}
export async function updateItem(owner: CartOwner, itemId: string, quantity: number) {
  const cart = await Cart.findOne(ownerFilter(owner)); const item = cart?.items.id(itemId);
  if (!cart || !item) throw HttpError.notFound('Cart item not found.');
  const product = await Product.findOne({ _id: item.productId, isPublished: true }); const variant = product?.variants.id(item.variantId);
  if (!product || !variant) throw HttpError.conflict('The cart item is no longer available.');
  if (quantity > variant.stock) throw HttpError.conflict('Requested quantity exceeds current stock.');
  item.quantity = quantity; return dto(cart);
}
export async function removeItem(owner: CartOwner, itemId: string) {
  const cart = await Cart.findOne(ownerFilter(owner)); const item = cart?.items.id(itemId);
  if (!cart || !item) throw HttpError.notFound('Cart item not found.'); item.deleteOne(); return dto(cart);
}
export async function clearCart(owner: CartOwner) {
  const cart = await Cart.findOne(ownerFilter(owner)); if (!cart) return emptyDto();
  cart.items.splice(0); cart.promoCode = null; return dto(cart);
}
export async function applyPromo(owner: CartOwner, code: string): Promise<PromoResult> {
  const cart = await ownedCart(owner); await recalculate(cart); const result = evaluatePromo(code, cart.subtotal);
  if (result.valid) { cart.promoCode = code; await recalculate(cart); }
  return result;
}
export async function removePromo(owner: CartOwner) {
  const cart = await Cart.findOne(ownerFilter(owner)); if (!cart) return emptyDto(); cart.promoCode = null; return dto(cart);
}
export async function mergeCart(userId: string, guestId: string) {
  const guest = await Cart.findOne({ guestId }); if (!guest) return getCart({ userId });
  const user = await ownedCart({ userId });
  // Pre-validate the complete merge before applying any line mutations.
  await currentItems(guest); await currentItems(user);
  const additions = guest.items.map((item) => ({ productId: item.productId, variantId: item.variantId,
    colour: item.colour, size: item.size, quantity: item.quantity, price: item.price }));
  for (const incoming of additions) {
    const product = await Product.findOne({ _id: incoming.productId, isPublished: true }); const variant = product?.variants.id(incoming.variantId);
    if (!product || !variant) throw HttpError.conflict('A guest cart item is no longer available.');
    const existing = user.items.find((item) => item.productId.equals(incoming.productId) && item.variantId.equals(incoming.variantId));
    if ((existing?.quantity ?? 0) + incoming.quantity > variant.stock) throw HttpError.conflict('Merged quantity exceeds current stock.');
  }
  for (const incoming of additions) { const existing = user.items.find((item) => item.productId.equals(incoming.productId) && item.variantId.equals(incoming.variantId)); if (existing) existing.quantity += incoming.quantity; else user.items.push(incoming); }
  const result = await dto(user); await guest.deleteOne(); return result;
}
