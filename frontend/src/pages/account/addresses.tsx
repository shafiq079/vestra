import { useState } from 'react';
import { MapPin, Plus, Trash2, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Address } from '@/types';
import { USE_MOCK_API } from '@/services/apiClient';
import * as profileService from '@/services/profileService';

export function AccountAddressesPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: '', firstName: '', lastName: '', line1: '', line2: '', city: '', county: '', postcode: '', country: 'United Kingdom' });

  const addresses = user?.addresses || [];

  const replaceUser = useAuthStore((s) => s.replaceUser);
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAddr: Address = { id: `addr${Date.now()}`, ...form, isDefault: addresses.length === 0 };
    if (USE_MOCK_API) await updateUser({ addresses: [...addresses, newAddr] });
    else replaceUser(await profileService.addAddress({ ...form, isDefault: addresses.length === 0 }));
    toast.success('Address saved');
    setOpen(false);
    setForm({ label: '', firstName: '', lastName: '', line1: '', line2: '', city: '', county: '', postcode: '', country: 'United Kingdom' });
  };

  const handleDelete = async (id: string) => {
    if (USE_MOCK_API) await updateUser({ addresses: addresses.filter((a) => a.id !== id) });
    else replaceUser(await profileService.deleteAddress(id));
    toast.info('Address removed');
  };

  const handleSetDefault = async (id: string) => {
    if (USE_MOCK_API) await updateUser({ addresses: addresses.map((a) => ({ ...a, isDefault: a.id === id })) });
    else replaceUser(await profileService.setDefaultAddress(id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl lg:text-3xl">Addresses</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add Address</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Address</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><Label htmlFor="label">Label</Label><Input id="label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home, Work..." className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="firstName">First name</Label><Input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1" /></div>
                <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1" /></div>
              </div>
              <div><Label htmlFor="line1">Address line 1</Label><Input id="line1" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor="line2">Address line 2 (optional)</Label><Input id="line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="city">City</Label><Input id="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div>
                <div><Label htmlFor="county">County (optional)</Label><Input id="county" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="postcode">Postcode</Label><Input id="postcode" required value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className="mt-1" /></div>
                <div><Label htmlFor="country">Country</Label><Input id="country" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1" /></div>
              </div>
              <DialogFooter><Button type="submit">Save Address</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-20 border border-border rounded-xl">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="border border-border rounded-xl p-5 relative">
              {addr.isDefault && <span className="absolute top-3 right-3 text-xs font-medium bg-muted px-2 py-1 rounded">Default</span>}
              <p className="font-medium">{addr.label}</p>
              <p className="text-sm text-muted-foreground mt-2">{addr.firstName} {addr.lastName}</p>
              <p className="text-sm text-muted-foreground">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
              <p className="text-sm text-muted-foreground">{addr.city}, {addr.county}</p>
              <p className="text-sm text-muted-foreground">{addr.postcode}, {addr.country}</p>
              <div className="flex gap-2 mt-4">
                {!addr.isDefault && <Button variant="outline" size="sm" onClick={() => handleSetDefault(addr.id)}><Check className="h-3 w-3" /> Set Default</Button>}
                <Button variant="outline" size="sm" onClick={() => handleDelete(addr.id)}><Trash2 className="h-3 w-3" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
