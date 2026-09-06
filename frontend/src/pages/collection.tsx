import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getByCollection } from '@/services/productService';
import { getCollection } from '@/services/categoryService';
import { ProductCard } from '@/components/product/product-card';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';

export function CollectionPage() {
  const { slug } = useParams();
  const { data: collection } = useQuery({ queryKey: ['collection-details', slug], queryFn: () => getCollection(slug!), enabled: !!slug });
  const { data: products, isLoading } = useQuery({
    queryKey: ['collection', slug],
    queryFn: () => getByCollection(slug!),
    enabled: !!slug,
  });

  return (
    <div className="container-vestra py-8 lg:py-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Collections', href: '/shop' }, { label: collection?.name || slug || '' }]} />
      {collection && (
        <div className="relative h-[40vh] min-h-[300px] rounded-xl overflow-hidden mt-4 mb-8">
          <img src={collection.image} alt={collection.name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <p className="text-sm uppercase tracking-widest opacity-90">{collection.season}</p>
            <h1 className="font-display text-3xl lg:text-5xl mt-1">{collection.name}</h1>
            <p className="mt-2 max-w-xl opacity-90">{collection.description}</p>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-product rounded-lg" />)}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="text-center py-20"><p className="text-muted-foreground">No products in this collection yet.</p><Link to="/shop" className="text-foreground underline mt-4 inline-block">Browse all products</Link></div>
      )}
    </div>
  );
}
