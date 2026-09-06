import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { applyPromoCode as validatePromoCode } from '@/services/cartService';
import { formatPrice } from '@/utils/formatters';
import { brand } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export function CartPage() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const discount = useCartStore((s) => s.discount);
  const promoCode = useCartStore((s) => s.promoCode);
  const applyPromo = useCartStore((s) => s.applyPromoCode);
  const removePromo = useCartStore((s) => s.removePromoCode);
  const [promoInput, setPromoInput] = useState('');

  const deliveryCost = subtotal >= brand.deliveryThreshold || subtotal === 0 ? 0 : 4.95;
  const total = Math.max(0, subtotal - discount + deliveryCost);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    const result = await validatePromoCode(promoInput, subtotal);
    if (result.valid) {
      applyPromo(promoInput.toUpperCase(), result.discount);
      toast.success('Promo code applied');
      setPromoInput('');
    } else {
      toast.error(result.message);
    }
  };
  const mutateCart = async (operation: () => Promise<void>, success?: string) => {
    try { await operation(); if (success) toast.info(success); }
    catch (error) { toast.error((error as Error).message || 'Unable to update your bag'); }
  };

  if (items.length === 0) {
    return (
      <div className="container-vestra py-20 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
        <h1 className="font-display text-2xl mt-4">Your bag is empty</h1>
        <p className="text-muted-foreground mt-2">Discover our latest collections and find your perfect fit.</p>
        <Button asChild className="mt-6"><Link to="/shop">Continue Shopping</Link></Button>
      </div>
    );
  }

  return (
    <div className="container-vestra py-8 lg:py-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Shopping Bag' }]} />
      <h1 className="font-display text-3xl lg:text-4xl mt-4 mb-8">Shopping Bag</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 p-4 border border-border rounded-xl">
              <Link to={`/product/${item.product.slug}`}><img src={item.product.images[0]?.url} alt={item.product.name} className="w-24 h-32 object-cover rounded-lg" /></Link>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <Link to={`/product/${item.product.slug}`} className="font-medium hover:opacity-70">{item.product.name}</Link>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.colour} · {item.size}</p>
                  </div>
                  <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center border border-border rounded-lg">
                    <button onClick={() => void mutateCart(() => updateQuantity(item.id, item.quantity - 1))} className="px-3 py-1.5 hover:bg-muted" aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                    <span className="px-3 text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => void mutateCart(() => updateQuantity(item.id, item.quantity + 1))} className="px-3 py-1.5 hover:bg-muted" aria-label="Increase"><Plus className="h-3 w-3" /></button>
                  </div>
                  <button onClick={() => void mutateCart(() => removeItem(item.id), 'Item removed')} className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1"><Trash2 className="h-4 w-4" /> Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="border border-border rounded-xl p-6 space-y-4 sticky top-24">
            <h2 className="font-semibold text-lg">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-success"><span>Discount ({promoCode})</span><span>−{formatPrice(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{deliveryCost === 0 ? 'Free' : formatPrice(deliveryCost)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-base"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>
            {/* Promo code */}
            {promoCode ? (
              <div className="flex items-center justify-between bg-muted px-3 py-2 rounded-lg"><span className="text-sm flex items-center gap-1"><Tag className="h-3 w-3" /> {promoCode}</span><button onClick={() => void mutateCart(removePromo, 'Promo code removed')}><X className="h-4 w-4 text-muted-foreground" /></button></div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Promo code" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()} />
                <Button variant="outline" onClick={handleApplyPromo}>Apply</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Try code VESTRA10 for 10% off</p>
            <Button asChild size="lg" className="w-full"><Link to="/checkout">Checkout <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" className="w-full"><Link to="/shop">Continue Shopping</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
