import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const hasWishlist = useWishlistStore((s) => s.hasItem(product.id));
  const addItem = useCartStore((s) => s.addItem);
  const price = product.salePrice ?? product.price;
  const hasSale = product.salePrice !== undefined && product.salePrice < product.price;
  const handleWishlist = async () => { try { await toggleWishlist(product); } catch (error) { toast.error((error as Error).message || 'Sign in to update your wishlist'); } };
  const handleQuickAdd = async () => {
    const variant = product.variants[0];
    if (!variant) return;
    try { await addItem(product, variant.id, variant.colour, variant.size, 1); toast.success(`${product.name} added to bag`); }
    catch (error) { toast.error((error as Error).message || 'Unable to add this item'); }
  };

  return (
    <div className={cn('group relative', className)}>
      <div className="relative overflow-hidden rounded-lg bg-muted aspect-product">
        <Link to={`/product/${product.slug}`}>
          <img src={product.images[0]?.url} alt={product.images[0]?.alt || product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </Link>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.badges.includes('new') && <span className="bg-background text-foreground text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded">New</span>}
          {hasSale && <span className="bg-destructive text-destructive-foreground text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded">Sale</span>}
          {product.badges.includes('bestseller') && <span className="bg-foreground text-background text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded">Bestseller</span>}
        </div>
        {/* Wishlist */}
        <button onClick={() => void handleWishlist()} className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-colors" aria-label="Toggle wishlist">
          <Heart className={cn('h-4 w-4', hasWishlist && 'fill-destructive text-destructive')} />
        </button>
        {/* Quick add */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button onClick={() => void handleQuickAdd()} className="w-full bg-background/95 backdrop-blur-sm text-foreground text-sm font-medium py-2.5 rounded-md hover:bg-background flex items-center justify-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Quick Add
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Link to={`/product/${product.slug}`} className="block">
          <p className="text-sm font-medium line-clamp-1">{product.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{product.category}</p>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatPrice(price)}</span>
          {hasSale && <span className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</span>}
        </div>
        {/* Colour swatches */}
        <div className="flex gap-1.5 pt-1">
          {product.colours.slice(0, 5).map((c) => {
            const variant = product.variants.find((v) => v.colour === c);
            return <span key={c} className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: variant?.colourHex || '#ccc' }} title={c} />;
          })}
        </div>
      </div>
    </div>
  );
}
