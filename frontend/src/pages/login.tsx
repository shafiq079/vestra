import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { errorMessage } from '@/utils/errorMessage';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDemo = async (role: 'customer' | 'admin') => {
    setEmail(role === 'admin' ? 'admin@vestra.co.uk' : 'emma.thompson@example.co.uk');
    toast.info('Demo email filled in. Enter the configured demo password to continue.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Welcome back!');
      const mergeWarning = useAuthStore.getState().cartMergeWarning;
      if (mergeWarning) toast.warning(`Signed in successfully, but your guest bag could not be merged. ${mergeWarning}`);
      navigate(user.role === 'admin' ? '/admin' : '/account');
    } catch (err) {
      toast.error(errorMessage(err, 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-vestra py-12 lg:py-20 max-w-md">
      <h1 className="font-display text-3xl text-center">Sign In</h1>
      <p className="text-center text-muted-foreground mt-2">Welcome back to VESTRA</p>
      <form onSubmit={handleSubmit} className="space-y-4 mt-8">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.co.uk" className="mt-1" /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" /></div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
      </form>
      <div className="flex justify-between text-sm mt-4">
        <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
        <Link to="/register" className="text-muted-foreground hover:text-foreground">Create account</Link>
      </div>
      <div className="relative my-6"><Separator /><span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">or</span></div>
      <p className="text-sm text-muted-foreground text-center mb-3">Try the demo</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => void handleDemo('customer')}>Demo Customer</Button>
        <Button variant="outline" onClick={() => void handleDemo('admin')}>Demo Admin</Button>
      </div>
      <p className="text-xs text-center text-muted-foreground mt-4">Demo customer: emma.thompson@example.co.uk · Demo admin: admin@vestra.co.uk</p>
    </div>
  );
}
