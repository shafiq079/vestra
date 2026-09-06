import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, CreditCard, Lock, Truck } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { createOrder } from '@/services/orderService';
import { formatPrice } from '@/utils/formatters';
import { brand } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Address, DeliveryOption, Order } from '@/types';
import { errorMessage } from '@/utils/errorMessage';

const deliveryOptions: DeliveryOption[] = [
  { id: 'del1', name: 'Standard Delivery', description: '3-5 working days', price: 0, estimatedDays: '3-5 working days' },
  { id: 'del2', name: 'Express Delivery', description: '1-2 working days', price: 7.95, estimatedDays: '1-2 working days' },
  { id: 'del3', name: 'Next Day Delivery', description: 'Next working day', price: 12.95, estimatedDays: 'Next working day' },
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const discount = useCartStore((s) => s.discount);
  const promoCode = useCartStore((s) => s.promoCode);
  const resetLocalCart = useCartStore((s) => s.resetLocalCart);
  const user = useAuthStore((s) => s.user);

  const [deliveryId, setDeliveryId] = useState('del1');
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({
    email: user?.email || '', firstName: user?.firstName || '', lastName: user?.lastName || '',
    line1: '', line2: '', city: '', county: '', postcode: '', country: 'United Kingdom',
    cardNumber: '', cardExpiry: '', cardCvc: '',
  });

  const delivery = deliveryOptions.find((d) => d.id === deliveryId)!;
  const deliveryCost = subtotal >= brand.deliveryThreshold ? 0 : delivery.price;
  const total = Math.max(0, subtotal - discount + deliveryCost);

  const setField = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.firstName || !form.line1 || !form.city || !form.postcode) { toast.error('Please fill in all required fields'); return; }
    setProcessing(true);
    try {
      const shippingAddress: Address = { id: 'ship', label: 'Shipping', firstName: form.firstName, lastName: form.lastName, line1: form.line1, line2: form.line2, city: form.city, county: form.county, postcode: form.postcode, country: form.country, isDefault: false };
      const order: Partial<Order> = {
        userId: user?.id, guestEmail: user ? undefined : form.email,
        items: items.map((i) => ({ id: i.id, productId: i.productId, productName: i.product.name, productImage: i.product.images[0]?.url || '', brand: i.product.brand, colour: i.colour, size: i.size, quantity: i.quantity, price: i.price })),
        shippingAddress, deliveryOption: delivery,
        subtotal, discount, deliveryCost, total, promoCode,
      };
      const created = await createOrder(order);
      resetLocalCart();
      navigate(`/order-confirmation/${created.id}`, { state: created });
    } catch (error) {
      toast.error(errorMessage(error, 'Something went wrong. Please try again.'));
    } finally {
      setProcessing(false);
    }
  };

  if (items.length === 0) {
    return <div className="container-vestra py-20 text-center"><h1 className="font-display text-2xl">Your bag is empty</h1><Button asChild className="mt-4"><Link to="/shop">Continue Shopping</Link></Button></div>;
  }

  return (
    <div className="container-vestra py-8 lg:py-12">
      <h1 className="font-display text-3xl lg:text-4xl mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Contact */}
          <section className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-foreground text-background text-sm flex items-center justify-center">1</span> Contact</h2>
            <div><Label htmlFor="email">Email address</Label><Input id="email" type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} className="mt-1" /></div>
          </section>
          <Separator />
          {/* Shipping */}
          <section className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-foreground text-background text-sm flex items-center justify-center">2</span> Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="firstName">First name</Label><Input id="firstName" required value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" required value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} className="mt-1" /></div>
            </div>
            <div><Label htmlFor="line1">Address line 1</Label><Input id="line1" required value={form.line1} onChange={(e) => setField('line1', e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="line2">Address line 2 (optional)</Label><Input id="line2" value={form.line2} onChange={(e) => setField('line2', e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="city">City</Label><Input id="city" required value={form.city} onChange={(e) => setField('city', e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="county">County (optional)</Label><Input id="county" value={form.county} onChange={(e) => setField('county', e.target.value)} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="postcode">Postcode</Label><Input id="postcode" required value={form.postcode} onChange={(e) => setField('postcode', e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="country">Country</Label><Input id="country" required value={form.country} onChange={(e) => setField('country', e.target.value)} className="mt-1" /></div>
            </div>
          </section>
          <Separator />
          {/* Delivery */}
          <section className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-foreground text-background text-sm flex items-center justify-center">3</span> Delivery Method</h2>
            <RadioGroup value={deliveryId} onValueChange={setDeliveryId} className="space-y-2">
              {deliveryOptions.map((opt) => (
                <div key={opt.id} className="flex items-center justify-between border border-border rounded-lg p-4">
                  <div className="flex items-center gap-3"><RadioGroupItem value={opt.id} id={opt.id} /><div><Label htmlFor={opt.id} className="font-medium cursor-pointer">{opt.name}</Label><p className="text-sm text-muted-foreground">{opt.description}</p></div></div>
                  <span className="text-sm font-medium">{opt.price === 0 ? 'Free' : formatPrice(opt.price)}</span>
                </div>
              ))}
            </RadioGroup>
          </section>
          <Separator />
          {/* Payment */}
          <section className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-foreground text-background text-sm flex items-center justify-center">4</span> Payment <Lock className="h-4 w-4 text-muted-foreground" /></h2>
            <div><Label htmlFor="cardNumber">Card number</Label><div className="relative mt-1"><Input id="cardNumber" placeholder="1234 5678 9012 3456" value={form.cardNumber} onChange={(e) => setField('cardNumber', e.target.value)} className="pr-10" /><CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="cardExpiry">Expiry date</Label><Input id="cardExpiry" placeholder="MM/YY" value={form.cardExpiry} onChange={(e) => setField('cardExpiry', e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="cardCvc">CVC</Label><Input id="cardCvc" placeholder="123" value={form.cardCvc} onChange={(e) => setField('cardCvc', e.target.value)} className="mt-1" /></div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> This is a demo checkout. No payment will be processed.</p>
          </section>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="border border-border rounded-xl p-6 space-y-4 sticky top-24">
            <h2 className="font-semibold text-lg">Order Summary</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <img src={item.product.images[0]?.url} alt={item.product.name} className="w-14 h-18 object-cover rounded" />
                  <div className="flex-1 text-sm"><p className="font-medium line-clamp-1">{item.product.name}</p><p className="text-muted-foreground">{item.colour} · {item.size} · Qty {item.quantity}</p><p className="font-medium">{formatPrice(item.price * item.quantity)}</p></div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-success"><span>Discount ({promoCode})</span><span>−{formatPrice(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{deliveryCost === 0 ? 'Free' : formatPrice(deliveryCost)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-base"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={processing}>{processing ? 'Processing...' : 'Place Order'}</Button>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Free delivery over £75</span>
              <span className="flex items-center gap-1"><Check className="h-3 w-3" /> 30-day returns</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
