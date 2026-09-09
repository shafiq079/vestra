import { Sparkles, Ruler, Camera, Shield, Leaf, Award } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="container-vestra py-12 lg:py-20">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="font-display text-4xl lg:text-5xl mb-4">About VESTRA</h1>
        <p className="text-lg text-muted-foreground">Premium UK fashion powered by intelligent fit technology. We believe great style starts with clothes that truly fit.</p>
      </div>

      <div className="aspect-[21/9] rounded-2xl overflow-hidden mb-16">
        <img src="https://images.unsplash.com/photo-1445205170140-6ab0a0fac000?w=1600&q=80" alt="VESTRA atelier" className="w-full h-full object-cover" />
      </div>

      <div className="max-w-3xl mx-auto space-y-12">
        <section>
          <h2 className="font-display text-2xl mb-4">Our Story</h2>
          <p className="leading-7 text-muted-foreground">Founded on Savile Row, VESTRA began with a simple observation: the most common reason for returning online clothing is poor fit. We set out to change that by combining traditional British tailoring expertise with modern technology. Today, every garment we make is designed with fit data at its core, so you can shop with confidence from home.</p>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-ai-background rounded-xl p-6">
            <Sparkles className="h-8 w-8 text-ai mb-3" />
            <h3 className="font-semibold mb-2">AI-Powered Recommendations</h3>
            <p className="text-sm text-muted-foreground">Our recommendation engine learns your style preferences and suggests pieces you'll love, based on your browsing, wishlist, and purchase history.</p>
          </div>
          <div className="bg-ai-background rounded-xl p-6">
            <Ruler className="h-8 w-8 text-ai mb-3" />
            <h3 className="font-semibold mb-2">Size Recommendation</h3>
            <p className="text-sm text-muted-foreground">Our measurement-based ML recommendation is planned for Phase 13 and is not currently available.</p>
          </div>
          <div className="bg-ai-background rounded-xl p-6">
            <Camera className="h-8 w-8 text-ai mb-3" />
            <h3 className="font-semibold mb-2">Virtual Fitting Room</h3>
            <p className="text-sm text-muted-foreground">See how a garment looks on you before you buy. Upload a photo and our virtual try-on shows you a realistic preview.</p>
          </div>
          <div className="bg-ai-background rounded-xl p-6">
            <Shield className="h-8 w-8 text-ai mb-3" />
            <h3 className="font-semibold mb-2">Privacy First</h3>
            <p className="text-sm text-muted-foreground">VTO photos are sent only with consent to temporary Cloudinary storage and Pixelcut processing, with VESTRA cleanup and transparent retention limits.</p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl mb-6 text-center">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center"><Leaf className="h-8 w-8 mx-auto text-success mb-3" /><h3 className="font-semibold mb-1">Sustainable</h3><p className="text-sm text-muted-foreground">Natural fibres, responsible sourcing, and reduced returns through better fit.</p></div>
            <div className="text-center"><Award className="h-8 w-8 mx-auto text-success mb-3" /><h3 className="font-semibold mb-1">Quality First</h3><p className="text-sm text-muted-foreground">Every piece is crafted to last, from premium materials to expert construction.</p></div>
            <div className="text-center"><Sparkles className="h-8 w-8 mx-auto text-ai mb-3" /><h3 className="font-semibold mb-1">Innovation</h3><p className="text-sm text-muted-foreground">We invest in technology that makes your shopping experience better, not just different.</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
