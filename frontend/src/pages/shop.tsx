import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from '@/components/product/product-card';
import { getFacetProducts, getProducts } from '@/services/productService';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { FilterState, SortOption } from '@/types';

export function ShopPage() {
  const [searchParams] = useSearchParams();
  const gender = searchParams.get('gender') as FilterState['genderCollection'] | null;
  const onSaleParam = searchParams.get('onSale') === 'true';
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColours, setSelectedColours] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);

  const filters: FilterState = {
    genderCollection: gender || undefined,
    onSale: onSaleParam || undefined,
    size: selectedSizes.length > 0 ? selectedSizes : undefined,
    colour: selectedColours.length > 0 ? selectedColours : undefined,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    sortBy,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['products', filters, page],
    queryFn: () => getProducts(filters, page, 12),
  });
  const { data: facetProducts = [] } = useQuery({
    queryKey: ['product-facets', gender, onSaleParam],
    queryFn: () => getFacetProducts({ genderCollection: gender || undefined, onSale: onSaleParam || undefined }),
  });

  const allSizes = useMemo(() => [...new Set(facetProducts.flatMap((p) => p.availableSizes))], [facetProducts]);
  const allColours = useMemo(() => [...new Set(facetProducts.flatMap((p) => p.colours))].slice(0, 12), [facetProducts]);

  const title = gender ? (gender === 'women' ? 'Women' : 'Men') : onSaleParam ? 'Sale' : 'All Products';

  return (
    <div className="container-vestra py-8 lg:py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl lg:text-4xl">{title}</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal className="h-4 w-4" /> Filters</Button>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="bestselling">Best Selling</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Filters sidebar */}
        <aside className={`${showFilters ? 'fixed inset-0 z-50 bg-background p-6 overflow-y-auto' : 'hidden'} lg:relative lg:block lg:w-64 lg:shrink-0`}>
          {showFilters && <div className="flex justify-between items-center mb-4 lg:hidden"><h2 className="text-lg font-semibold">Filters</h2><button onClick={() => setShowFilters(false)}><X className="h-5 w-5" /></button></div>}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">Price Range</h3>
              <Slider value={priceRange} onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])} min={0} max={500} step={25} className="my-4" />
              <div className="flex justify-between text-sm text-muted-foreground"><span>£{priceRange[0]}</span><span>£{priceRange[1]}</span></div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3">Size</h3>
              <div className="grid grid-cols-3 gap-2">
                {allSizes.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <Checkbox id={`size-${s}`} checked={selectedSizes.includes(s)} onCheckedChange={() => setSelectedSizes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} />
                    <Label htmlFor={`size-${s}`} className="text-sm">{s}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3">Colour</h3>
              <div className="space-y-2">
                {allColours.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <Checkbox id={`colour-${c}`} checked={selectedColours.includes(c)} onCheckedChange={() => setSelectedColours((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />
                    <Label htmlFor={`colour-${c}`} className="text-sm">{c}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Products grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-product rounded-lg" />)}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">{data.total} products</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: data.totalPages }).map((_, i) => (
                    <Button key={i} variant={page === i + 1 ? 'default' : 'outline'} size="sm" onClick={() => setPage(i + 1)}>{i + 1}</Button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20"><p className="text-muted-foreground">No products found. Try adjusting your filters.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
