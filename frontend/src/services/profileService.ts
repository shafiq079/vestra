import { USE_MOCK_API, apiClient } from './apiClient';
import type { Address, MeasurementProfile, User } from '../types';

export async function updateProfile(updates: Pick<Partial<User>, 'firstName' | 'lastName' | 'avatar' | 'marketingOptIn'>): Promise<User> {
  if (USE_MOCK_API) throw new Error('Mock profile updates are managed by the auth store.');
  return (await apiClient.patch<User>('/profile', updates)).data;
}

export async function addAddress(address: Omit<Address, 'id'>): Promise<User> {
  return (await apiClient.post<User>('/profile/addresses', address)).data;
}
export async function deleteAddress(id: string): Promise<User> {
  return (await apiClient.delete<User>(`/profile/addresses/${id}`)).data;
}
export async function setDefaultAddress(id: string): Promise<User> {
  return (await apiClient.patch<User>(`/profile/addresses/${id}/default`)).data;
}
export async function updateMeasurementProfile(profile: Omit<MeasurementProfile, 'id' | 'userId' | 'lastUpdated'>): Promise<MeasurementProfile> {
  return (await apiClient.patch<MeasurementProfile>('/profile/measurement-profile', profile)).data;
}
