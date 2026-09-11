import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLayoutEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, ShoppingBag, Ruler, Scan, Star, ChevronLeft, ChevronRight, Truck, RefreshCw, Shield } from 'lucide-react';
import { getProduct, getRelated } from '@/services/productService';
import { getProductReviews } from '@/services/reviewService';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useUIStore } from '@/store/uiStore';
import { ProductCard } from '@/components/product/product-card';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice, getDiscountPercent } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function ProductPageSkeleton() {
  return (
    <div className="container-vestra py-4 lg:py-8" aria-busy="true" aria-label="Loading product">
      <Skeleton className="h-4 w-48" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-6">
        <div>
          <Skeleton className="w-full aspect-product rounded-xl" />
          <div className="flex gap-2 mt-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="w-16 h-20 rounded-md" />
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-3/4 mt-3" />
          <Skeleton className="h-4 w-44 mt-4" />
          <Skeleton className="h-8 w-28 mt-5" />
          <Skeleton className="h-5 w-full max-w-md mt-5" />
          <Skeleton className="h-5 w-4/5 max-w-sm mt-2" />

          <div className="mt-7">
            <Skeleton className="h-4 w-24 mb-3" />
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="w-9 h-9 rounded-full" />
              ))}
            </div>
          </div>

          <div className="mt-7">
            <Skeleton className="h-4 w-20 mb-3" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="w-12 h-11 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="mt-7">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-11 w-32 rounded-lg" />
          </div>

          <div className="flex gap-3 mt-8">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-12 rounded-lg" />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 lg:mt-16">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3 mt-6 max-w-3xl">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useQuery({ queryKey: ['product', slug], queryFn: () => getProduct(slug!) });
  const { data: related } = useQuery({ queryKey: ['related', slug], queryFn: () => getRelated(product?.id || ''), enabled: !!product?.id });

  const [selectedColour, setSelectedColour] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setSelectedColour('');
    setSelectedSize('');
    setQuantity(1);
    setActiveImage(0);
  }, [slug]);

  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const hasWishlist = useWishlistStore((s) => product ? s.hasItem(product.id) : false);
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);

  const { data: reviews = [] } = useQuery({ queryKey: ['product-reviews', product?.id], queryFn: () => getProductReviews(product!.id), enabled: !!product });

  if (isLoading) return <ProductPageSkeleton />;
  if (!product) return <div className="container-vestra py-20 text-center"><p>Product not found.</p><Button asChild className="mt-4"><Link to="/shop">Back to shop</Link></Button></div>;

  const price = product.salePrice ?? product.price;
  const hasSale = product.salePrice !== undefined && product.salePrice < product.price;
  const reviewTabCount = product.reviewCount;
  const colour = selectedColour || product.colours[0];
  const availableSizesForColour = product.variants.filter((v) => v.colour === colour).map((v) => v.size);
  const size = selectedSize || availableSizesForColour[0] || product.availableSizes[0];
  const hasTryOnImage = product.images.some((image) => image.isTryOnReady && !image.isLifestyle
    && (!image.colour || image.colour === colour));
  const canTryOn = product.tryOnEligible && hasTryOnImage
    && product.variants.some((variant) => variant.colour === colour && variant.stock > 0);

  const handleAddToCart = async () => {
    const variant = product.variants.find((v) => v.colour === colour && v.size === size);
    if (!variant) { toast.error('Selected variant is not available'); return; }
    try { await addItem(product, variant.id, colour, size, quantity); toast.success(`${product.name} added to bag`); setCartDrawerOpen(true); }
    catch (error) { toast.error((error as Error).message || 'Unable to add this item'); }
  };
  const handleWishlist = async () => {
    try { await toggleWishlist(product); toast.success(hasWishlist ? 'Removed from wishlist' : 'Added to wishlist'); }
    catch (error) { toast.error((error as Error).message || 'Unable to update your wishlist'); }
  };

  return (
    <div className="container-vestra py-4 lg:py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: product.name }]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-6">
        {/* Images */}
        <div>
          <div className="relative overflow-hidden rounded-xl bg-muted aspect-product">
            <img src={product.images[activeImage]?.url} alt={product.images[activeImage]?.alt || product.name} className="w-full h-full object-cover" />
            {hasSale && <Badge variant="destructive" className="absolute top-4 left-4">{getDiscountPercent(product.price, product.salePrice!)}% Off</Badge>}
            {product.images.length > 1 && (
              <>
                <button onClick={() => setActiveImage((p) => (p - 1 + product.images.length) % product.images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 rounded-full hover:bg-background" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => setActiveImage((p) => (p + 1) % product.images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 rounded-full hover:bg-background" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {product.images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImage(i)} className={cn('w-16 h-20 rounded-md overflow-hidden border-2', activeImage === i ? 'border-foreground' : 'border-transparent')}>
                  <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">{product.brand}</p>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">{product.name}</h1>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('h-4 w-4', i < Math.round(product.rating) ? 'fill-foreground' : 'text-muted-foreground')} />)}
            </div>
            <span className="text-sm text-muted-foreground">{product.rating} · {product.reviewCount} reviews</span>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <span className="text-2xl font-semibold">{formatPrice(price)}</span>
            {hasSale && <span className="text-lg text-muted-foreground line-through">{formatPrice(product.price)}</span>}
          </div>
          <p className="mt-4 text-muted-foreground">{product.shortDescription}</p>

          {/* Colour selection */}
          <div className="mt-6">
            <p className="text-sm font-medium mb-2">Colour: <span className="text-muted-foreground">{colour}</span></p>
            <div className="flex gap-2">
              {product.colours.map((c) => {
                const variant = product.variants.find((v) => v.colour === c);
                return <button key={c} onClick={() => { setSelectedColour(c); setSelectedSize(''); }} className={cn('w-9 h-9 rounded-full border-2 transition-colors', colour === c ? 'border-foreground' : 'border-border')} style={{ backgroundColor: variant?.colourHex || '#ccc' }} title={c} aria-label={c} />;
              })}
            </div>
          </div>

          {/* Size selection */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Size: <span className="text-muted-foreground">{size}</span></p>
              {product.sizeRecommendationEligible && <button onClick={() => navigate(`/product/${product.slug}?sizeRec=true`)} className="text-sm text-ai hover:underline flex items-center gap-1"><Ruler className="h-4 w-4" /> Find My Size</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.availableSizes.map((s) => {
                const variant = product.variants.find((v) => v.colour === colour && v.size === s);
                const outOfStock = variant?.stock === 0;
                return <button key={s} disabled={outOfStock} onClick={() => setSelectedSize(s)} className={cn('min-w-12 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors', size === s ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground', outOfStock && 'opacity-40 cursor-not-allowed line-through')}>{s}</button>;
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="mt-6">
            <p className="text-sm font-medium mb-2">Quantity</p>
            <div className="flex items-center border border-border rounded-lg w-fit">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2.5 hover:bg-muted" aria-label="Decrease">−</button>
              <span className="px-4 py-2.5 font-medium min-w-12 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2.5 hover:bg-muted" aria-label="Increase">+</button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <Button size="lg" className="flex-1" onClick={handleAddToCart}><ShoppingBag className="h-5 w-5" /> Add to Bag</Button>
            <Button size="lg" variant="outline" onClick={() => void handleWishlist()}><Heart className={cn('h-5 w-5', hasWishlist && 'fill-destructive text-destructive')} /></Button>
          </div>

          {canTryOn && (
            <Button asChild variant="outline" size="lg" className="w-full mt-3"><Link to={`/virtual-fitting-room?productId=${product.id}&colour=${encodeURIComponent(colour)}`}><Scan className="h-5 w-5" /> Try On Virtually</Link></Button>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border">
            <div className="flex flex-col items-center text-center gap-1"><Truck className="h-5 w-5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Free delivery over £75</p></div>
            <div className="flex flex-col items-center text-center gap-1"><RefreshCw className="h-5 w-5 text-muted-foreground" /><p className="text-xs text-muted-foreground">30-day returns</p></div>
            <div className="flex flex-col items-center text-center gap-1"><Shield className="h-5 w-5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Secure checkout</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-12 lg:mt-16">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start border-b border-border rounded-none">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="details">Details & Care</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviewTabCount})</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="py-6 max-w-3xl">
            <p className="text-muted-foreground leading-relaxed">{product.fullDescription}</p>
            {product.fitDescription && <p className="mt-4 text-sm"><span className="font-medium">Fit:</span> {product.fitDescription}</p>}
            {product.modelInformation && <p className="mt-2 text-sm"><span className="font-medium">Model:</span> {product.modelInformation}</p>}
          </TabsContent>
          <TabsContent value="details" className="py-6 max-w-3xl">
            <div className="space-y-4">
              <div><h3 className="font-medium mb-2">Materials</h3><ul className="text-sm text-muted-foreground space-y-1">{product.materials.map((m) => <li key={m}>{m}</li>)}</ul></div>
              <div><h3 className="font-medium mb-2">Care Instructions</h3><ul className="text-sm text-muted-foreground space-y-1">{product.careInstructions.map((c) => <li key={c}>{c}</li>)}</ul></div>
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="py-6">
            <div className="space-y-6">
              {reviews.length === 0 ? <p className="text-muted-foreground">{product.reviewCount > 0 ? 'Detailed customer reviews are not currently available through the public API.' : 'No reviews yet.'}</p> : reviews.map((r) => (
                <div key={r.id} className="border-b border-border pb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('h-4 w-4', i < r.rating ? 'fill-foreground' : 'text-muted-foreground')} />)}</div>
                    {r.isVerified && <Badge variant="secondary" className="text-xs">Verified</Badge>}
                  </div>
                  <h4 className="font-medium">{r.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{r.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{r.userName} · {new Date(r.createdAt).toLocaleDateString('en-GB')}</p>
                  {r.fitFeedback && <p className="text-xs mt-1"><span className="font-medium">Fit:</span> {r.fitFeedback === 'runs_small' ? 'Runs small' : r.fitFeedback === 'runs_large' ? 'Runs large' : 'True to size'}</p>}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Related */}
      {related && related.length > 0 && (
        <section className="mt-12 lg:mt-16">
          <h2 className="font-display text-2xl mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}