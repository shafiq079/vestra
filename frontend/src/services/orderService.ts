import { AUTH_TOKEN_KEY, apiClient, guestCartHeaders } from './apiClient';
import type { Order } from '../types';
export async function getOrders(userId?: string): Promise<Order[]> { return (await apiClient.get<Order[]>('/orders', { params: { userId } })).data; }
export async function getOrder(orderId: string): Promise<Order | null> { return (await apiClient.get<Order>(`/orders/${orderId}`)).data; }
export async function createOrder(orderData: Partial<Order>): Promise<Order> { return (await apiClient.post<Order>('/orders', orderData, { headers: localStorage.getItem(AUTH_TOKEN_KEY) ? undefined : guestCartHeaders() })).data; }
