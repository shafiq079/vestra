import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { errorMessage } from '@/utils/errorMessage';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', marketingOptIn: true });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created. Welcome to VESTRA!');
      const mergeWarning = useAuthStore.getState().cartMergeWarning;
      if (mergeWarning) toast.warning(`Your account was created, but your guest bag could not be merged. ${mergeWarning}`);
      navigate('/account');
    } catch (error) {
      toast.error(errorMessage(error, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-vestra py-12 lg:py-20 max-w-md">
      <h1 className="font-display text-3xl text-center">Create Account</h1>
      <p className="text-center text-muted-foreground mt-2">Join VESTRA for a personalised shopping experience</p>
      <form onSubmit={handleSubmit} className="space-y-4 mt-8">
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="firstName">First name</Label><Input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1" /></div>
        </div>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" /></div>
        <div className="flex items-center gap-2"><Checkbox id="marketing" checked={form.marketingOptIn} onCheckedChange={(v) => setForm({ ...form, marketingOptIn: !!v })} /><Label htmlFor="marketing" className="text-sm cursor-pointer">Send me news, exclusives and offers</Label></div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</Button>
      </form>
      <p className="text-center text-sm mt-6">Already have an account? <Link to="/login" className="font-medium hover:underline">Sign in</Link></p>
    </div>
  );
}
