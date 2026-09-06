import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { getRecommendationsByPage } from '@/services/recommendationService';
import { ProductCard } from '@/components/product/product-card';

export function AccountRecommendationsPage() {
  const { data: groups, isLoading } = useQuery({ queryKey: ['recs-account'], queryFn: () => getRecommendationsByPage('account') });

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-ai" />
        <h1 className="font-display text-2xl lg:text-3xl">My Recommendations</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">Personalised picks based on your wishlist, previous purchases, and catalogue preferences.</p>

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2].map((i) => <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="space-y-12">
          {groups.map((group) => (
            <section key={group.id}>
              <h2 className="font-display text-xl mb-1">{group.title}</h2>
              {group.subtitle && <p className="text-sm text-muted-foreground mb-4">{group.subtitle}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {group.items.map((item) => <ProductCard key={item.productId} product={item.product} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-border rounded-xl">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">No recommendations yet. Add products to your wishlist or make a purchase to shape your picks.</p>
        </div>
      )}
    </div>
  );
}
