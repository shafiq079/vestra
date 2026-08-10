import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { mainNavItems } from '@/config/navigation';

export function MobileMenu() {
  const open = useUIStore((s) => s.mobileMenuOpen);
  const setOpen = useUIStore((s) => s.setMobileMenuOpen);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overscroll-none lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      <div className="relative flex h-full w-full max-w-xs flex-col bg-background shadow-xl animate-in slide-in-from-left duration-300">
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-display text-xl font-bold">
            VESTRA
          </span>

          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain p-4">
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-border/50 py-3 text-base font-medium"
                >
                  {item.label}
                </Link>

                {item.children && (
                  <ul className="space-y-1 pb-2 pl-4">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <Link
                          to={child.href}
                          onClick={() => setOpen(false)}
                          className="block py-2 text-sm text-muted-foreground"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2">
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium"
            >
              My Account
            </Link>

            <Link
              to="/account/wishlist"
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium"
            >
              Wishlist
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}