import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Scan, Ruler } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/product/product-card';
import { getFeatured, getNewIn, getSale } from '@/services/productService';
import { getRecommendationsByPage } from '@/services/recommendationService';
import { mockCollections } from '@/mocks/categories';

export function HomePage() {
  const { data: featured } = useQuery({ queryKey: ['featured'], queryFn: getFeatured });
  const { data: newArrivals } = useQuery({ queryKey: ['new-in'], queryFn: getNewIn });
  const { data: sale } = useQuery({ queryKey: ['sale'], queryFn: getSale });
  const { data: recommendations } = useQuery({ queryKey: ['recs-home'], queryFn: () => getRecommendationsByPage('homepage') });

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&q=80" alt="Autumn collection" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative container-vestra h-full flex flex-col justify-center items-center text-center text-white">
          <p className="text-sm uppercase tracking-widest mb-3 opacity-90">Autumn / Winter 2024</p>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl max-w-3xl text-balance">Style that understands your fit</h1>
          <p className="mt-4 text-lg opacity-90 max-w-xl">Premium fashion with intelligent fit technology. Find your perfect size, try on virtually, and shop with confidence.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/shop" className="inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-white/90 transition-colors">Shop Now <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/virtual-fitting-room" className="inline-flex items-center justify-center gap-2 border border-white/50 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors">Virtual Fitting Room</Link>
          </div>
        </div>
      </section>

      {/* Technology banner */}
      <section className="bg-ai-background py-12">
        <div className="container-vestra">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/virtual-fitting-room" className="flex items-start gap-4 p-6 bg-card rounded-xl hover:shadow-md transition-shadow">
              <div className="p-3 bg-ai-background rounded-lg"><Scan className="h-6 w-6 text-ai" /></div>
              <div><h3 className="font-semibold">Virtual Try-On</h3><p className="text-sm text-muted-foreground mt-1">See how garments look on you before buying.</p></div>
            </Link>
            <Link to="/size-guide" className="flex items-start gap-4 p-6 bg-card rounded-xl hover:shadow-md transition-shadow">
              <div className="p-3 bg-ai-background rounded-lg"><Ruler className="h-6 w-6 text-ai" /></div>
              <div><h3 className="font-semibold">Size Recommendation</h3><p className="text-sm text-muted-foreground mt-1">Get your perfect size with AI-powered measurements.</p></div>
            </Link>
            <Link to="/account/recommendations" className="flex items-start gap-4 p-6 bg-card rounded-xl hover:shadow-md transition-shadow">
              <div className="p-3 bg-ai-background rounded-lg"><Sparkles className="h-6 w-6 text-ai" /></div>
              <div><h3 className="font-semibold">Personalised Picks</h3><p className="text-sm text-muted-foreground mt-1">Recommendations tailored to your style and fit.</p></div>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && featured.length > 0 && (
        <section className="container-vestra py-12 lg:py-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl lg:text-3xl">Featured</h2>
            <Link to="/shop" className="text-sm font-medium hover:opacity-70 flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {featured.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Collections */}
      <section className="bg-muted py-12 lg:py-16">
        <div className="container-vestra">
          <h2 className="font-display text-2xl lg:text-3xl mb-6 text-center">Shop by Collection</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mockCollections.map((col) => (
              <Link key={col.id} to={`/collection/${col.slug}`} className="group relative overflow-hidden rounded-xl aspect-[4/5]">
                <img src={col.image} alt={col.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="font-display text-xl">{col.name}</h3>
                  <p className="text-sm opacity-90 mt-1 line-clamp-2">{col.description}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium">Discover <ArrowRight className="h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      {newArrivals && newArrivals.length > 0 && (
        <section className="container-vestra py-12 lg:py-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl lg:text-3xl">New Arrivals</h2>
            <Link to="/new-in" className="text-sm font-medium hover:opacity-70 flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <section className="bg-muted py-12 lg:py-16">
          <div className="container-vestra">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-ai" />
              <h2 className="font-display text-2xl lg:text-3xl">{recommendations[0].title}</h2>
            </div>
            <p className="text-muted-foreground mb-6">{recommendations[0].subtitle}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {recommendations[0].items.slice(0, 4).map((item) => <ProductCard key={item.productId} product={item.product} />)}
            </div>
          </div>
        </section>
      )}

      {/* Sale */}
      {sale && sale.length > 0 && (
        <section className="container-vestra py-12 lg:py-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl lg:text-3xl">On Sale</h2>
            <Link to="/shop?onSale=true" className="text-sm font-medium hover:opacity-70 flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {sale.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
