import { MeasurementProfile } from '../models';
import { HttpError } from '../utils/httpError';
import type { AddressInput, AddressUpdate, MeasurementInput } from '../validators/profile';
import { buildUserDto } from './userDtoService';
import type { HydratedDocument } from 'mongoose';
import type { UserShape } from '../models/User';

type UserDocument = HydratedDocument<UserShape>;
export const getProfile = (user: UserDocument) => buildUserDto(user);

export async function updateProfile(user: UserDocument, input: Record<string, unknown>) {
  for (const [key, value] of Object.entries(input)) {
    if (key === 'avatar' && value === null) user.set(key, undefined); else user.set(key, value);
  }
  await user.save(); return buildUserDto(user);
}
export const listAddresses = (user: UserDocument) => user.addresses.map((a) => a.toJSON());
export async function addAddress(user: UserDocument, input: AddressInput) {
  const makeDefault = user.addresses.length === 0 || input.isDefault === true;
  if (makeDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  user.addresses.push({ ...input, isDefault: makeDefault }); await user.save(); return buildUserDto(user);
}
function ownedAddress(user: UserDocument, id: string) {
  const address = user.addresses.id(id); if (!address) throw HttpError.notFound('Address not found.'); return address;
}
export async function updateAddress(user: UserDocument, id: string, input: AddressUpdate) {
  const address = ownedAddress(user, id);
  if (input.isDefault === true) user.addresses.forEach((a) => { a.isDefault = false; });
  for (const [key, value] of Object.entries(input)) address.set(key, value);
  if (input.isDefault === false && !user.addresses.some((item) => item.isDefault)) {
    const replacement = user.addresses.find((item) => item._id.toString() !== id);
    (replacement ?? address).isDefault = true;
  }
  await user.save(); return buildUserDto(user);
}
export async function setDefaultAddress(user: UserDocument, id: string) {
  ownedAddress(user, id); user.addresses.forEach((a) => { a.isDefault = a._id.toString() === id; }); await user.save(); return buildUserDto(user);
}
export async function deleteAddress(user: UserDocument, id: string) {
  const address = ownedAddress(user, id); const wasDefault = address.isDefault; address.deleteOne();
  if (wasDefault && user.addresses.length > 0) user.addresses[0]!.isDefault = true;
  await user.save(); return buildUserDto(user);
}
export async function getMeasurementProfile(userId: string) { const p = await MeasurementProfile.findOne({ userId }); return p?.toJSON() ?? null; }
export async function updateMeasurementProfile(userId: string, input: MeasurementInput) {
  const existing = await MeasurementProfile.findOne({ userId });
  if (!existing && !input.unitSystem) throw HttpError.badRequest('Invalid measurement profile.', { unitSystem: ['Required when creating a measurement profile.'] });
  const profile = existing ?? new MeasurementProfile({ userId, unitSystem: input.unitSystem });
  for (const [key, value] of Object.entries(input)) profile.set(key, value);
  profile.lastUpdated = new Date(); await profile.save(); return profile.toJSON();
}
