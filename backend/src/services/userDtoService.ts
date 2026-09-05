import type { HydratedDocument } from 'mongoose';
import { MeasurementProfile, User, WishlistItem, type UserShape } from '../models';

export interface UserDto {
  id: string; email: string; firstName: string; lastName: string;
  role: 'customer' | 'admin'; avatar?: string; addresses: unknown[];
  measurementProfile?: unknown; wishlistIds: string[]; createdAt: string;
  isActive: boolean; marketingOptIn: boolean;
}

export async function buildUserDto(userOrId: HydratedDocument<UserShape> | string): Promise<UserDto> {
  const user = typeof userOrId === 'string' ? await User.findById(userOrId) : userOrId;
  if (!user) throw new Error('Cannot assemble a missing user.');
  const [measurement, wishlist] = await Promise.all([
    MeasurementProfile.findOne({ userId: user._id }),
    WishlistItem.find({ userId: user._id }).select('productId').lean(),
  ]);
  const persisted = user.toJSON() as unknown as Omit<UserDto, 'wishlistIds'>;
  return {
    ...persisted,
    ...(measurement ? { measurementProfile: measurement.toJSON() } : {}),
    wishlistIds: wishlist.map((item) => item.productId.toString()),
  };
}
