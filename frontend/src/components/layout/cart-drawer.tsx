import { Link } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/formatters';
import { brand } from '@/config/brand';
import { toast } from 'sonner';

export function CartDrawer() {
  const open = useUIStore((s) => s.cartDrawerOpen);
  const setOpen = useUIStore((s) => s.setCartDrawerOpen);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const mutateCart = async (operation: () => Promise<void>) => {
    try { await operation(); }
    catch (error) { toast.error((error as Error).message || 'Unable to update your bag'); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Shopping bag">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md bg-background shadow-xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Shopping Bag</h2>
          <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 hover:opacity-70"><X className="h-5 w-5" /></button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Your bag is empty</p>
            <Button asChild><Link to="/shop" onClick={() => setOpen(false)}>Continue Shopping</Link></Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Link to={`/product/${item.product.slug}`} onClick={() => setOpen(false)} className="shrink-0">
                    <img src={item.product.images[0]?.url} alt={item.product.name} className="w-20 h-24 object-cover rounded-md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product.slug}`} onClick={() => setOpen(false)} className="text-sm font-medium hover:opacity-70 line-clamp-1">{item.product.name}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.colour} · {item.size}</p>
                    <p className="text-sm font-semibold mt-1">{formatPrice(item.price)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-border rounded-md">
                        <button onClick={() => void mutateCart(() => updateQuantity(item.id, item.quantity - 1))} className="p-1.5 hover:bg-muted" aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                        <span className="px-2 text-sm font-medium min-w-8 text-center">{item.quantity}</span>
                        <button onClick={() => void mutateCart(() => updateQuantity(item.id, item.quantity + 1))} className="p-1.5 hover:bg-muted" aria-label="Increase"><Plus className="h-3 w-3" /></button>
                      </div>
                      <button onClick={() => void mutateCart(() => removeItem(item.id))} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
              <p className="text-xs text-muted-foreground">{subtotal >= brand.deliveryThreshold ? 'You qualify for free delivery' : `Add ${formatPrice(brand.deliveryThreshold - subtotal)} for free delivery`}</p>
              <Button asChild className="w-full" size="lg"><Link to="/cart" onClick={() => setOpen(false)}>View Bag</Link></Button>
              <Button asChild variant="outline" className="w-full"><Link to="/checkout" onClick={() => setOpen(false)}>Checkout</Link></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
