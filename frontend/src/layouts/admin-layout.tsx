import { useEffect, useState } from 'react';
import {
  Outlet,
  NavLink,
  Link,
  useLocation,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Star,
  Tag,
  Sparkles,
  Menu,
  X,
  Store,
  User,
  Boxes,
  FolderTree,
} from 'lucide-react';
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
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    group: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/admin/products',
        icon: Package,
      },
      {
        label: 'Categories',
        href: '/admin/categories',
        icon: FolderTree,
      },
      {
        label: 'Inventory',
        href: '/admin/inventory',
        icon: Boxes,
      },
    ],
  },
  {
    group: 'Sales',
    items: [
      {
        label: 'Orders',
        href: '/admin/orders',
        icon: ShoppingCart,
      },
      {
        label: 'Promotions',
        href: '/admin/promotions',
        icon: Tag,
      },
    ],
  },
  {
    group: 'Customers',
    items: [
      {
        label: 'Customers',
        href: '/admin/users',
        icon: Users,
      },
      {
        label: 'Reviews',
        href: '/admin/reviews',
        icon: Star,
      },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      {
        label: 'AI Features',
        href: '/admin/ai-features',
        icon: Sparkles,
      },
    ],
  },
];

const allNavItems = adminNavGroups.flatMap(
  (group) => group.items
);

function sectionLabel(pathname: string): string {
  const match = allNavItems.find((item) =>
    item.end
      ? pathname === item.href
      : pathname.startsWith(item.href)
  );

  return match?.label ?? 'Dashboard';
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  /*
   * Prevent the admin page behind the mobile sidebar
   * from scrolling while the sidebar is open.
   */
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Admin sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 h-dvh w-64 overflow-hidden flex-col border-r border-border bg-card transition-transform lg:flex lg:translate-x-0',
          mobileOpen
            ? 'flex translate-x-0'
            : 'hidden -translate-x-full lg:flex'
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <Link
            to="/admin"
            className="font-display text-xl font-bold"
            onClick={() => setMobileOpen(false)}
          >
            VESTRA{' '}
            <span className="font-sans text-xs font-normal text-muted-foreground">
              Admin
            </span>
          </Link>

          <button
            type="button"
            className="text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable sidebar navigation */}
        <nav className="scrollbar-vestra flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {adminNavGroups.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.group}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.end}
                    onClick={() =>
                      setMobileOpen(false)
                    }
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />

                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-border p-4">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Store className="h-4 w-4" />
            View Store
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 overscroll-none bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main admin area */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        {/* Admin header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="shrink-0 text-muted-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="truncate text-sm font-medium text-muted-foreground">
              {sectionLabel(location.pathname)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Store className="h-4 w-4" />

              <span className="hidden sm:inline">
                View Store
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-tight">
                  {user?.firstName ?? 'Admin'}
                </p>

                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Admin page content */}
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}