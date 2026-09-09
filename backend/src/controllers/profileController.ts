import type { Request, RequestHandler } from 'express';
import * as profile from '../services/profileService';
import { parseAddress, parseAddressId, parseAddressUpdate, parseMeasurement, parseProfile } from '../validators/profile';

const addressId = (req: Request) => { const raw = req.params.addressId; const value = Array.isArray(raw) ? raw[0]! : raw!; return parseAddressId(value).toString(); };
export const getProfile: RequestHandler = async (req, res) => { res.json(await profile.getProfile(req.auth!.user)); };
export const updateProfile: RequestHandler = async (req, res) => { res.json(await profile.updateProfile(req.auth!.user, parseProfile(req.body))); };
export const listAddresses: RequestHandler = async (req, res) => { res.json(profile.listAddresses(req.auth!.user)); };
export const addAddress: RequestHandler = async (req, res) => { res.status(201).json(await profile.addAddress(req.auth!.user, parseAddress(req.body))); };
export const updateAddress: RequestHandler = async (req, res) => { res.json(await profile.updateAddress(req.auth!.user, addressId(req), parseAddressUpdate(req.body))); };
export const deleteAddress: RequestHandler = async (req, res) => { res.json(await profile.deleteAddress(req.auth!.user, addressId(req))); };
export const setDefaultAddress: RequestHandler = async (req, res) => { res.json(await profile.setDefaultAddress(req.auth!.user, addressId(req))); };
export const getMeasurement: RequestHandler = async (req, res) => { res.json(await profile.getMeasurementProfile(req.auth!.userId)); };
export const updateMeasurement: RequestHandler = async (req, res) => { res.json(await profile.updateMeasurementProfile(req.auth!.userId, parseMeasurement(req.body))); };
