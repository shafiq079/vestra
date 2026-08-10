import { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, Star, Tag, Sparkles, Menu, X, Store, User, Boxes, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

interface NavEntry {
  label: string;
  href: string;
  icon: typeof Package;
  end?: boolean;
}
interface NavGroup {
  group: string;
  items: NavEntry[];
}

const adminNavGroups: NavGroup[] = [
  {
    group: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, end: true }],
  },
  {
    group: 'Catalog',
    items: [
      { label: 'Products', href: '/admin/products', icon: Package },
      { label: 'Categories', href: '/admin/categories', icon: FolderTree },
      { label: 'Inventory', href: '/admin/inventory', icon: Boxes },
    ],
  },
  {
    group: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
      { label: 'Promotions', href: '/admin/promotions', icon: Tag },
    ],
  },
  {
    group: 'Customers',
    items: [
      { label: 'Customers', href: '/admin/users', icon: Users },
      { label: 'Reviews', href: '/admin/reviews', icon: Star },
    ],
  },
  {
    group: 'Intelligence',
    items: [{ label: 'AI Features', href: '/admin/ai-features', icon: Sparkles }],
  },
];

const allNavItems = adminNavGroups.flatMap((g) => g.items);

function sectionLabel(pathname: string): string {
  const match = allNavItems.find((n) => (n.end ? pathname === n.href : pathname.startsWith(n.href)));
  return match?.label ?? 'Dashboard';
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex-col bg-card border-r border-border transition-transform lg:flex lg:translate-x-0',
          mobileOpen ? 'flex translate-x-0' : 'hidden -translate-x-full lg:flex'
        )}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link to="/admin" className="font-display text-xl font-bold">
            VESTRA <span className="text-xs font-sans font-normal text-muted-foreground">Admin</span>
          </Link>
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobileOpen(false)} aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-4">
          {adminNavGroups.map((group) => (
            <div key={group.group}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors', isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
                  >
                    <item.icon className="h-4 w-4" /> {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Store className="h-4 w-4" /> View Store
          </Link>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="min-w-0 flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-muted-foreground" onClick={() => setMobileOpen(true)} aria-label="Open sidebar">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-muted-foreground">{sectionLabel(location.pathname)}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <Store className="h-4 w-4" /> <span className="hidden sm:inline">View Store</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-tight">{user?.firstName ?? 'Admin'}</p>
                <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground">Sign out</button>
              </div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
