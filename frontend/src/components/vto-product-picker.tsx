import { useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import type { Product, GenderCollection } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { handleImageError, getProductImageUrl } from '@/utils/imageUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface VtoProductPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onSelect: (product: Product) => void;
  selectedProductId?: string;
}

const GENDERS: { value: 'all' | GenderCollection; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'unisex', label: 'Unisex' },
];

function formatFilterLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function VtoProductPicker({ open, onOpenChange, products, onSelect, selectedProductId }: VtoProductPickerProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState<'all' | GenderCollection>('all');
  const [category, setCategory] = useState<string>('all');

  // Categories come from the eligible products returned by the API. This keeps
  // Virtual Try-On open to new admin-created categories such as accessories,
  // caps, shoes, or future product types without another frontend code change.
  const categories = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.category).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (gender !== 'all' && p.genderCollection !== gender) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.shortDescription.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, gender, category]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    onOpenChange(false);
  };

  const filterBar = (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="pl-9"
          aria-label="Search eligible products"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {GENDERS.map((g) => (
          <Button
            key={g.value}
            size="sm"
            variant={gender === g.value ? 'default' : 'outline'}
            onClick={() => setGender(g.value)}
            aria-pressed={gender === g.value}
          >
            {g.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={category === 'all' ? 'default' : 'outline'}
          onClick={() => setCategory('all')}
          aria-pressed={category === 'all'}
        >
          All Categories
        </Button>
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? 'default' : 'outline'}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
          >
            {formatFilterLabel(c)}
          </Button>
        ))}
      </div>
    </div>
  );

  const productList = (
    <div className="space-y-2 overflow-y-auto">
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No eligible products found.
        </div>
      ) : (
        filtered.map((p) => (
          <div
            key={p.id}
            className={`flex gap-3 items-center rounded-lg border p-2 transition-colors ${
              selectedProductId === p.id ? 'border-foreground bg-muted/40' : 'border-border hover:border-foreground/40'
            }`}
          >
            <img
              src={getProductImageUrl(p.images[0]?.url)}
              alt={p.images[0]?.alt || p.name}
              onError={handleImageError}
              className="h-16 w-16 rounded-md object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-1">{p.name}</p>
              <p className="text-sm text-muted-foreground">{formatPrice(p.salePrice ?? p.price)}</p>
              <div className="flex gap-1 mt-1">
                {p.colours.slice(0, 4).map((c) => {
                  const v = p.variants.find((v) => v.colour === c);
                  return (
                    <span
                      key={c}
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: v?.colourHex }}
                      title={c}
                    />
                  );
                })}
                {p.colours.length > 4 && (
                  <span className="text-xs text-muted-foreground">+{p.colours.length - 4}</span>
                )}
              </div>
            </div>
            <Button size="sm" onClick={() => handleSelect(p)} aria-label={`Select ${p.name}`}>
              Select
            </Button>
          </div>
        ))
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle>Choose a product to try on</SheetTitle>
            <SheetDescription>Choose any VTO-eligible product. Your uploaded photo stays ready while you switch products.</SheetDescription>
          </SheetHeader>
          <div className="px-4 py-3 border-b shrink-0">{filterBar}</div>
          <div className="flex-1 overflow-y-auto px-4 py-3">{productList}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Choose a product to try on</DialogTitle>
          <DialogDescription>Choose any VTO-eligible product. Your uploaded photo stays ready while you switch products.</DialogDescription>
        </DialogHeader>
        <div className="shrink-0">{filterBar}</div>
        <div className="flex-1 overflow-y-auto max-h-[55vh] pr-1">{productList}</div>
      </DialogContent>
    </Dialog>
  );
}
