import { AUTH_TOKEN_KEY, USE_MOCK_API, apiClient, guestCartHeaders } from './apiClient';
import { mockOrders, getOrdersByUserId, getOrderById } from '../mocks/orders';
import { mockRequest } from '../mocks/mockDatabase';
import type { Order } from '../types';

export async function getOrders(userId?: string): Promise<Order[]> {
  if (USE_MOCK_API) {
    if (userId) return mockRequest(getOrdersByUserId(userId));
    return mockRequest(mockOrders);
  }
  const response = await apiClient.get('/orders', { params: { userId } });
  return response.data;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 300));
    return getOrderById(orderId) || null;
  }
  const response = await apiClient.get(`/orders/${orderId}`);
  return response.data;
}

export async function createOrder(orderData: Partial<Order>): Promise<Order> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 600));
    const newOrder: Order = {
      id: `ord${Date.now()}`,
      orderNumber: `VST-2024-${String(Math.floor(Math.random() * 999)).padStart(4, '0')}`,
      userId: orderData.userId,
      guestEmail: orderData.guestEmail,
      items: orderData.items || [],
      shippingAddress: orderData.shippingAddress!,
      deliveryOption: orderData.deliveryOption!,
      subtotal: orderData.subtotal || 0,
      discount: orderData.discount || 0,
      deliveryCost: orderData.deliveryCost || 0,
      total: orderData.total || 0,
      promoCode: orderData.promoCode,
      status: 'confirmed',
      paymentStatus: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDelivery: orderData.estimatedDelivery || '',
    };
    return newOrder;
  }
  const response = await apiClient.post('/orders', orderData, {
    headers: localStorage.getItem(AUTH_TOKEN_KEY) ? undefined : guestCartHeaders(),
  });
  return response.data;
}
