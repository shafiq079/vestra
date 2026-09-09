import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scan, Upload, X, Sparkles, CircleAlert as AlertCircle, Loader as Loader2, ShoppingBag, Ruler, RefreshCw, Trash2, Shirt, Palette, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cancelTryOnJob, getEligibleProducts, getProductForTryOn, getTryOnJob, resultFromJob, submitTryOn, submitTryOnFeedback, vtoProcessingMessages } from '@/services/virtualTryOnService';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useUIStore } from '@/store/uiStore';
import { VtoProductPicker } from '@/components/vto-product-picker';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { formatPrice } from '@/utils/formatters';
import { handleImageError, getProductImageUrl } from '@/utils/imageUtils';
import { toast } from 'sonner';
import type { ApiError, Product, VirtualTryOnJob, VirtualTryOnResult } from '@/types';

const MAX_SUGGESTIONS = 4;

function resolveColour(product: Product, requested: string | null): string {
  if (requested && product.colours.includes(requested)) return requested;
  return product.colours[0];
}

export function VirtualFittingRoomPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlProductId = searchParams.get('productId');
  const urlColour = searchParams.get('colour');

  const { data: eligibleProducts, isLoading: eligibleLoading } = useQuery({
    queryKey: ['vto-eligible'],
    queryFn: getEligibleProducts,
  });

  const { data: urlProduct, isLoading: urlProductLoading } = useQuery({
    queryKey: ['vto-product', urlProductId],
    queryFn: () => (urlProductId ? getProductForTryOn(urlProductId) : Promise.resolve(null)),
    enabled: !!urlProductId,
  });

  const wishlistItems = useWishlistStore((s) => s.items);

  // Selected product + colour (URL is the source of truth for product)
  const selectedProduct = urlProduct ?? null;

  const selectedColour = selectedProduct
  ? resolveColour(selectedProduct, urlColour)
  : '';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invalidProduct, setInvalidProduct] = useState(false);

  // Photo handling — browser memory only
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consent + processing + result
  const [consent, setConsent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);
  const [result, setResult] = useState<VirtualTryOnResult | null>(null);
  const [activeJob, setActiveJob] = useState<VirtualTryOnJob | null>(null);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const generationRef = useRef(0);
  const selectionRef = useRef('');

  const addItem = useCartStore((s) => s.addItem);
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);

  // Sync colour when selected product changes/loads
  useEffect(() => {
  if (selectedProduct) {
    setInvalidProduct(false);
  }
}, [selectedProduct]);

  // Mark invalid if a productId was supplied but resolves to nothing eligible
  useEffect(() => {
    if (urlProductId && !urlProductLoading && !urlProduct) {
      setInvalidProduct(true);
    } else if (urlProduct) {
      setInvalidProduct(false);
    }
  }, [urlProductId, urlProduct, urlProductLoading]);

  // Keep colour consistent if URL colour param is invalid for the product
  useEffect(() => {
  if (!selectedProduct || selectedProduct.id !== urlProductId) return;

  const resolvedColour = resolveColour(selectedProduct, urlColour);

  if (urlColour !== resolvedColour) {
    setSearchParams(
      {
        productId: selectedProduct.id,
        colour: resolvedColour,
      },
      { replace: true }
    );
  }
}, [
  selectedProduct,
  urlProductId,
  urlColour,
  setSearchParams,
]);

  // Cleanup object URL on unmount or replacement
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!activeJob?.resultExpiresAt || !result) return;
    const remaining = new Date(activeJob.resultExpiresAt).getTime() - Date.now();
    if (remaining <= 0) { setResult(null); return; }
    const timer = window.setTimeout(() => { setResult(null); toast.info('This temporary preview has expired.'); }, remaining);
    return () => window.clearTimeout(timer);
  }, [activeJob?.resultExpiresAt, result]);

  // Also cover browser back/forward navigation, not only picker/colour click handlers.
  useEffect(() => {
    const selection = selectedProduct ? `${selectedProduct.id}:${selectedColour}` : '';
    if (selectionRef.current && selectionRef.current !== selection) {
      generationRef.current += 1;
      if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
        void cancelTryOnJob(activeJob.id, activeJob.accessToken).catch(() => undefined);
      }
      setActiveJob(null); setProcessing(false); setResult(null); setFeedback(null); setSelectedSize('');
    }
    selectionRef.current = selection;
  }, [selectedProduct, selectedColour, activeJob]);

  const selectProduct = (product: Product, colour?: string) => {
  const resolvedColour =
    colour && product.colours.includes(colour)
      ? colour
      : product.colours[0];

  setResult(null);
  setFeedback(null);
  setSelectedSize('');
  generationRef.current += 1;
  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) void cancelTryOnJob(activeJob.id, activeJob.accessToken).catch(() => undefined);
  setActiveJob(null);
  setProcessing(false);

  setSearchParams(
    {
      productId: product.id,
      colour: resolvedColour,
    },
    { replace: true }
  );
};

  const handleSelectFromPicker = (product: Product) => {
    selectProduct(product);
  };

  const handleColourChange = (colour: string) => {
  if (!selectedProduct) return;
  if (!selectedProduct.colours.includes(colour)) return;

  setResult(null);
  setFeedback(null);
  setSelectedSize('');
  generationRef.current += 1;
  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) void cancelTryOnJob(activeJob.id, activeJob.accessToken).catch(() => undefined);
  setActiveJob(null);
  setProcessing(false);

  setSearchParams(
    {
      productId: selectedProduct.id,
      colour,
    },
    { replace: true }
  );
};

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setResult(null); setFeedback(null); setSelectedSize('');
    generationRef.current += 1;
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) void cancelTryOnJob(activeJob.id, activeJob.accessToken).catch(() => undefined);
    setActiveJob(null); setProcessing(false);
    setImageFile(file);
    setImageUrl(url);
    e.target.value = '';
  };

  const replacePhoto = () => fileInputRef.current?.click();

  const removePhoto = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    setResult(null);
    setFeedback(null);
    setSelectedSize('');
    generationRef.current += 1;
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) void cancelTryOnJob(activeJob.id, activeJob.accessToken).catch(() => undefined);
    setActiveJob(null);
    setProcessing(false);
  };

  const clearSession = () => {
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) void cancelTryOnJob(activeJob.id, activeJob.accessToken).catch(() => undefined);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    setConsent(false);
    setResult(null);
    setFeedback(null);
    setProcessStep(0);
    setProcessing(false);
    setActiveJob(null);
    setSelectedSize('');
    generationRef.current += 1;
  };

  const handleTryOn = async () => {
    if (!selectedProduct || !imageFile || !consent) return;
    if (processing) return;
    setProcessing(true);
    setProcessStep(0);
    setResult(null);
    setFeedback(null);
    const generation = ++generationRef.current;
    const idempotencyKey = crypto.randomUUID();
    const stepInterval = setInterval(() => {
      setProcessStep((p) => Math.min(p + 1, vtoProcessingMessages.length - 1));
    }, 1200);
    try {
      let job = await submitTryOn({
        productId: selectedProduct.id,
        variantColour: selectedColour || selectedProduct.colours[0],
        imageFile,
        consentGiven: consent,
      }, idempotencyKey);
      if (generation !== generationRef.current) {
        if (job.status === 'pending' || job.status === 'running') void cancelTryOnJob(job.id, job.accessToken).catch(() => undefined);
        return;
      }
      setActiveJob(job);
      while (job.status === 'pending' || job.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (generation !== generationRef.current) return;
        job = await getTryOnJob(job.id, job.accessToken);
        setActiveJob(job);
      }
      if (job.status === 'completed') {
        const completed = resultFromJob(job);
        if (completed) setResult(completed);
      } else if (job.status === 'cancelled') {
        toast.info('Virtual Try-On cancelled');
      } else {
        throw job.error ?? new Error('Virtual Try-On could not be completed.');
      }
    } catch (error) {
      if (generation === generationRef.current) toast.error((error as ApiError).message || 'Try-on failed. Please try again.');
    } finally {
      clearInterval(stepInterval);
      if (generation === generationRef.current) setProcessing(false);
    }
  };

  const handleAddToBag = async () => {
    if (!selectedProduct) return;
    const colour = selectedColour || selectedProduct.colours[0];
    const size = selectedSize;
    if (!size) { toast.error('Choose a size before adding this item'); return; }
    const variant = selectedProduct.variants.find((v) => v.colour === colour && v.size === size);
    if (!variant) {
      toast.error('Please choose a size on the product page first');
      return;
    }
    try { await addItem(selectedProduct, variant.id, colour, size, 1); toast.success(`${selectedProduct.name} added to bag`); setCartDrawerOpen(true); }
    catch (error) { toast.error((error as Error).message || 'Unable to add this item'); }
  };

  const handleFeedback = async (value: 'helpful' | 'not_helpful') => {
    if (!activeJob) return;
    try {
      const updated = await submitTryOnFeedback(activeJob.id, value, activeJob.accessToken);
      setActiveJob(updated); setFeedback(value); toast.success('Thanks for your feedback');
    } catch (error) { toast.error((error as ApiError).message || 'Unable to save feedback'); }
  };

  const handleCancel = async () => {
    const job = activeJob; generationRef.current += 1;
    if (job) await cancelTryOnJob(job.id, job.accessToken).catch(() => undefined);
    setProcessing(false); setActiveJob(null); setResult(null); toast.info('Virtual Try-On cancelled');
  };

  // Suggestions for direct entry: up to MAX_SUGGESTIONS eligible products, wishlist-first
  const suggestions = useMemo(() => {
    if (!eligibleProducts) return [];
    const eligibleIds = new Set(eligibleProducts.map((p) => p.id));
    const wishlistEligible = wishlistItems
      .filter((w) => eligibleIds.has(w.productId))
      .map((w) => w.product);
    const remaining = eligibleProducts.filter((p) => !wishlistEligible.some((w) => w.id === p.id));
    return [...wishlistEligible, ...remaining].slice(0, MAX_SUGGESTIONS);
  }, [eligibleProducts, wishlistItems]);

  const hasSelection = !!selectedProduct;
  const canGenerate = hasSelection && !!imageFile && consent && !processing;

  return (
    <div className="container-vestra py-8 lg:py-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Virtual Fitting Room' }]} />

      <div className="text-center mt-4 mb-8">
        <div className="inline-flex items-center gap-2 bg-ai-background px-4 py-2 rounded-full text-ai text-sm font-medium">
          <Sparkles className="h-4 w-4" /> AI-Powered
        </div>
        <h1 className="font-display text-3xl lg:text-5xl mt-4">Virtual Fitting Room</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
           See how garments look on you before you buy. Upload a photo, choose a garment, and create an AI preview.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleImageUpload}
        aria-label="Upload your photo"
        data-testid="vto-photo-input"
      />

      {invalidProduct ? (
        <div className="max-w-xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>This item is not currently available for Virtual Try-On.</AlertTitle>
            <AlertDescription>
              The product may have been removed, unpublished, or is not eligible for virtual try-on.
            </AlertDescription>
          </Alert>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => setPickerOpen(true)}>
              <Shirt className="h-4 w-4" /> Choose Another Product
            </Button>
          </div>
        </div>
      ) : processing ? (
        <div className="max-w-md mx-auto text-center py-20" role="status" aria-live="polite">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-ai" />
          <p className="mt-6 font-medium">{vtoProcessingMessages[processStep]}...</p>
           <div className="flex justify-center gap-2 mt-4" aria-hidden="true">
            {vtoProcessingMessages.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i <= processStep ? 'bg-ai' : 'bg-muted'}`}
              />
            ))}
           </div>
           <Button variant="outline" className="mt-6" onClick={() => void handleCancel()}>Cancel</Button>
        </div>
      ) : result && selectedProduct ? (
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <figure>
              <figcaption className="text-sm font-medium mb-2">Your Photo</figcaption>
              <img
                src={imageUrl || ''}
                alt="Your uploaded photo"
                className="w-full rounded-xl object-cover aspect-product"
              />
            </figure>
            <figure className="relative">
              <figcaption className="text-sm font-medium mb-2">Virtual Try-On Preview</figcaption>
              <img
                src={getProductImageUrl(result.resultImage)}
                alt={`Virtual try-on preview of ${result.productName} in ${result.colour}`}
                onError={handleImageError}
                className="w-full rounded-xl object-cover aspect-product"
              />
              <Badge className="absolute top-2 left-2" variant="secondary">AI Preview</Badge>
            </figure>
          </div>

          <div className="mt-6 text-center">
            <p className="font-medium">{result.productName}</p>
            <p className="text-sm text-muted-foreground">Colour: {result.colour}</p>
            <p className="text-sm mt-1">{formatPrice(selectedProduct.salePrice ?? selectedProduct.price)}</p>
            <p className="text-xs text-muted-foreground mt-3">AI previews are visual guidance only and do not guarantee fit, colour, sizing, or exact garment detail. The result link is temporary.</p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm font-medium mb-3">Choose a size to add to bag</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedProduct.availableSizes.map((size) => {
                const variant = selectedProduct.variants.find((item) => item.colour === selectedColour && item.size === size);
                return <Button key={size} type="button" size="sm" variant={selectedSize === size ? 'default' : 'outline'} disabled={!variant || variant.stock < 1} onClick={() => setSelectedSize(size)}>{size}</Button>;
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Button onClick={handleAddToBag} disabled={!selectedSize}>
              <ShoppingBag className="h-4 w-4" /> Add to Bag
            </Button>
            <Button asChild variant="outline">
              <Link to={`/product/${selectedProduct.slug}?sizeRec=true`}>
                <Ruler className="h-4 w-4" /> Find My Size
              </Link>
            </Button>
            {selectedProduct.colours.length > 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  const el = document.getElementById('vto-result-colours');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <Palette className="h-4 w-4" /> Change Colour
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setFeedback(null);
                setPickerOpen(true);
              }}
            >
              <Shirt className="h-4 w-4" /> Try Another Product
            </Button>
            <Button variant="ghost" onClick={clearSession}>
              <Trash2 className="h-4 w-4" /> Clear Session
            </Button>
          </div>

          {selectedProduct.colours.length > 1 && (
            <div className="mt-6 border-t border-border pt-6" id="vto-result-colours">
              <p className="text-sm font-medium mb-3 text-center">Change Colour</p>
              <div className="flex gap-2 justify-center">
                {selectedProduct.colours.map((c) => {
                  const v = selectedProduct.variants.find((v) => v.colour === c);
                  const isActive = (selectedColour || selectedProduct.colours[0]) === c;
                  return (
                    <button
                      key={c}
                      onClick={() => handleColourChange(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-colors ${
                        isActive ? 'border-foreground' : 'border-border'
                      }`}
                      style={{ backgroundColor: v?.colourHex || '#ccc' }}
                      title={c}
                      aria-label={c}
                      aria-pressed={isActive}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-6 text-center">
            <p className="text-sm font-medium mb-3">Was this preview helpful?</p>
            <div className="flex gap-3 justify-center">
              <Button
                size="sm"
                variant={feedback === 'helpful' ? 'default' : 'outline'}
                onClick={() => handleFeedback('helpful')}
                aria-pressed={feedback === 'helpful'}
              >
                <ThumbsUp className="h-4 w-4" /> Helpful
              </Button>
              <Button
                size="sm"
                variant={feedback === 'not_helpful' ? 'default' : 'outline'}
                onClick={() => handleFeedback('not_helpful')}
                aria-pressed={feedback === 'not_helpful'}
              >
                <ThumbsDown className="h-4 w-4" /> Not Helpful
              </Button>
            </div>
          </div>
        </div>
      ) : hasSelection ? (
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Selected item summary */}
          <section className="border border-border rounded-xl p-4">
            <div className="flex gap-4 items-center">
              <img
                src={getProductImageUrl(selectedProduct.images[0]?.url)}
                alt={selectedProduct.images[0]?.alt || selectedProduct.name}
                onError={handleImageError}
                className="h-24 w-20 rounded-md object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Colour: {selectedColour || selectedProduct.colours[0]}
                </p>
                <p className="text-sm mt-0.5">
                  {formatPrice(selectedProduct.salePrice ?? selectedProduct.price)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                <RefreshCw className="h-4 w-4" /> Change Product
              </Button>
            </div>

            {selectedProduct.colours.length > 1 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Colour</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedProduct.colours.map((c) => {
                    const v = selectedProduct.variants.find((v) => v.colour === c);
                    const isActive = (selectedColour || selectedProduct.colours[0]) === c;
                    return (
                      <button
                        key={c}
                        onClick={() => handleColourChange(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${
                          isActive ? 'border-foreground' : 'border-border'
                        }`}
                        style={{ backgroundColor: v?.colourHex || '#ccc' }}
                        title={c}
                        aria-label={c}
                        aria-pressed={isActive}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Photo upload */}
          <section className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-foreground text-background text-sm flex items-center justify-center">
                1
              </span>{' '}
              Upload Your Photo
            </h2>
            {imageUrl ? (
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Your uploaded photo"
                  className="w-full max-h-80 rounded-xl object-contain bg-muted"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button size="sm" variant="secondary" onClick={replacePhoto} aria-label="Replace photo">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={removePhoto} aria-label="Remove photo">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl aspect-video w-full hover:border-foreground transition-colors"
                aria-label="Upload your photo"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium mt-3">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">JPG or PNG, max 10MB</p>
              </button>
            )}
          </section>

          {/* Consent + generate */}
          <section className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-foreground text-background text-sm flex items-center justify-center">
                2
              </span>{' '}
              Consent
            </h2>
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox id="vto-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                <Label htmlFor="vto-consent" className="text-sm cursor-pointer leading-relaxed">
                   I consent to VESTRA sending this photo to Cloudinary for temporary restricted storage and to
                   Pixelcut for AI processing. VESTRA deletes its temporary Cloudinary copy after the job, with
                   retry cleanup if deletion fails; Pixelcut controls its own short retention period. See our{' '}
                  <Link to="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </Label>
              </div>
            </div>
            <Button size="lg" className="w-full" onClick={handleTryOn} disabled={!canGenerate}>
               <Scan className="h-5 w-5" /> Generate Preview
            </Button>
          </section>
        </div>
      ) : eligibleLoading || (urlProductId && urlProductLoading) ? (
        <div className="text-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-4">Loading...</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-8 text-center">
          <div className="border border-dashed border-border rounded-xl p-10">
            <Shirt className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="font-display text-2xl mt-4">Choose something to try on</h2>
            <p className="text-muted-foreground mt-2">
              Browse VTO-eligible pieces and select one to preview on your photo.
            </p>
            <Button className="mt-6" size="lg" onClick={() => setPickerOpen(true)}>
              <Shirt className="h-5 w-5" /> Browse Eligible Products
            </Button>
          </div>

          {suggestions.length > 0 && (
            <section>
              <p className="text-sm font-medium mb-4">Suggestions</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="text-left rounded-lg overflow-hidden border border-border hover:border-foreground transition-colors"
                  >
                    <img
                      src={getProductImageUrl(p.images[0]?.url)}
                      alt={p.images[0]?.alt || p.name}
                      onError={handleImageError}
                      className="w-full aspect-product object-cover"
                    />
                    <p className="text-xs font-medium p-2 line-clamp-1">{p.name}</p>
                    <p className="text-xs text-muted-foreground px-2 pb-2">
                      {formatPrice(p.salePrice ?? p.price)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <VtoProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        products={eligibleProducts ?? []}
        onSelect={handleSelectFromPicker}
        selectedProductId={selectedProduct?.id}
      />
    </div>
  );
}
