import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/services/productService';
import { getCategory } from '@/services/categoryService';
import { ProductCard } from '@/components/product/product-card';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';

export function CategoryPage() {
  const { slug } = useParams();
  const { data: category } = useQuery({ queryKey: ['category', slug], queryFn: () => getCategory(slug!), enabled: !!slug });
  const { data, isLoading } = useQuery({
    queryKey: ['category-products', slug],
    queryFn: () => getProducts({ category: slug ? [slug] : undefined }),
  });

  return (
    <div className="container-vestra py-8 lg:py-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: category?.name || slug || '' }]} />
      <h1 className="font-display text-3xl lg:text-4xl mt-4 mb-6">{category?.name || 'Category'}</h1>
      {category?.description && <p className="text-muted-foreground mb-8 max-w-2xl">{category.description}</p>}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-product rounded-lg" />)}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="text-center py-20"><p className="text-muted-foreground">No products in this category yet.</p><Link to="/shop" className="text-foreground underline mt-4 inline-block">Browse all products</Link></div>
      )}
    </div>
  );
}
