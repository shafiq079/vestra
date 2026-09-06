// Phase 10 has not shipped: Virtual Try-On intentionally remains a demo provider.
const USE_DEMO_VTO = true;
import { mockRequest } from '../mocks/mockDatabase';
import { getProductById, getProducts } from '../mocks/productRepository';
import type { Product, VirtualTryOnRequest, VirtualTryOnResult } from '../types';

export async function getEligibleProducts(): Promise<Product[]> {
  if (USE_DEMO_VTO) {
    const products = getProducts().filter(
      (product) => product.isPublished && product.tryOnEligible
    );

    return mockRequest(products);
  }

  return [];
}

export async function getProductForTryOn(productId: string): Promise<Product | null> {
  if (USE_DEMO_VTO) {
    await new Promise((r) => setTimeout(r, 200));
    const product = getProductById(productId);
    if (!product || !product.isPublished || !product.tryOnEligible) return null;
    return product;
  }
  return null;
}

export async function submitTryOn(request: VirtualTryOnRequest): Promise<VirtualTryOnResult> {
  if (USE_DEMO_VTO) {
    await new Promise((r) => setTimeout(r, 3500));
    const product = getProductById(request.productId);
    return {
      id: `vto-${Date.now()}`,
      productId: request.productId,
      productName: product?.name ?? 'Selected garment',
      productImage: product?.images[0]?.url ?? '',
      resultImage: product?.images[0]?.url ?? 'https://images.unsplash.com/photo-1490481651871-ab68de25d43a?w=800&q=80',
      colour: request.variantColour,
      createdAt: new Date().toISOString(),
      isDemo: true,
    };
  }
  throw new Error('Virtual Try-On is not available.');
}

export const vtoProcessingMessages = [
  'Preparing your image',
  'Applying the selected garment',
  'Finishing your preview',
];
