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

      {/* Technology section */}
      <section className="bg-primary text-primary-foreground py-16 lg:py-20">
        <div className="container-vestra">
          <div className="max-w-2xl mb-10 lg:mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-ai/80 font-medium">Smarter Shopping</p>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl mt-3 text-balance">Designed around how you actually shop</h2>
            <p className="mt-4 text-base text-primary-foreground/70 max-w-xl text-pretty">Technology that helps you choose with more confidence, without getting in the way of your style.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-primary-foreground/10 border border-primary-foreground/10 rounded-xl overflow-hidden">
            <Link to="/virtual-fitting-room" className="group flex flex-col h-full p-8 bg-primary hover:bg-primary-foreground/[0.04] motion-safe:hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-lg border border-primary-foreground/15"><Scan className="h-7 w-7 text-ai" /></div>
                <span className="font-display text-2xl text-primary-foreground/30">01</span>
              </div>
              <h3 className="font-display text-xl lg:text-2xl">Virtual Try-On</h3>
              <p className="mt-2 text-sm text-primary-foreground/70 leading-relaxed">Preview selected pieces on yourself before deciding.</p>
            </Link>
            <Link to="/size-guide" className="group flex flex-col h-full p-8 bg-primary hover:bg-primary-foreground/[0.04] motion-safe:hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-lg border border-primary-foreground/15"><Ruler className="h-7 w-7 text-ai" /></div>
                <span className="font-display text-2xl text-primary-foreground/30">02</span>
              </div>
              <h3 className="font-display text-xl lg:text-2xl">Find Your Best Size</h3>
              <p className="mt-2 text-sm text-primary-foreground/70 leading-relaxed">Get a size recommendation based on your measurements and fit preferences.</p>
            </Link>
            <Link to="/account/recommendations" className="group flex flex-col h-full p-8 bg-primary hover:bg-primary-foreground/[0.04] motion-safe:hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-lg border border-primary-foreground/15"><Sparkles className="h-7 w-7 text-ai" /></div>
                <span className="font-display text-2xl text-primary-foreground/30">03</span>
              </div>
              <h3 className="font-display text-xl lg:text-2xl">Personalised Picks</h3>
              <p className="mt-2 text-sm text-primary-foreground/70 leading-relaxed">Discover pieces matched to your style, preferences and fit.</p>
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
