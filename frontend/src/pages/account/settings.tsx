import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    marketingOptIn: user?.marketingOptIn ?? false,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await updateUser({ firstName: form.firstName, lastName: form.lastName, marketingOptIn: form.marketingOptIn }); toast.success('Settings updated'); }
    catch (error) { toast.error((error as Error).message || 'Unable to update settings'); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl lg:text-3xl mb-6">Settings</h1>
      <div className="max-w-2xl space-y-8">
        <form onSubmit={handleSave} className="space-y-4">
          <h2 className="font-semibold text-lg">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="firstName">First name</Label><Input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1" /></div>
            <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} disabled className="mt-1" /><p className="text-xs text-muted-foreground mt-1">Contact support to change your email address.</p></div>
          <Button type="submit">Save Changes</Button>
        </form>

        <Separator />

        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Preferences</h2>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Marketing emails</p><p className="text-xs text-muted-foreground">Receive news, exclusive offers and early access to new collections.</p></div>
            <Switch checked={form.marketingOptIn} onCheckedChange={(v) => setForm({ ...form, marketingOptIn: v })} />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Account</h2>
          <p className="text-sm text-muted-foreground">Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-GB')}</p>
          <Button variant="outline" onClick={() => { logout(); }}>Sign Out</Button>
        </div>
      </div>
    </div>
  );
}
