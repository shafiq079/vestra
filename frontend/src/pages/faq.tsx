import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const faqs = [
  { q: 'How does the size recommendation work?', a: 'The measurement-based ML size recommendation is planned for Phase 13 and is not currently available. The size guide remains available as general guidance.' },
  { q: 'What is the Virtual Fitting Room?', a: 'With your explicit consent, VESTRA temporarily stores your photo privately in Cloudinary and sends a time-limited link to Pixelcut to create an AI preview. See the Privacy Policy for deletion and provider-retention details.' },
  { q: 'How long does delivery take?', a: 'Standard delivery takes 3-5 working days and is free on orders over £75. Express delivery (1-2 working days) costs £7.95. Next-day delivery is available for £12.95 if ordered before 2pm GMT.' },
  { q: 'What is your returns policy?', a: 'We offer 30-day free returns on all unworn items with tags attached. Returns are free for UK customers. Refunds are processed within 5 working days of receiving your return.' },
  { q: 'Can I change or cancel my order?', a: 'You can cancel or modify your order within 1 hour of placing it. Contact our customer care team immediately and we will do our best to help.' },
  { q: 'Do you ship internationally?', a: 'We currently ship to the UK and selected EU countries. International shipping costs and delivery times vary by destination. See our Delivery & Returns page for details.' },
  { q: 'How do I care for my VESTRA pieces?', a: 'Each product page includes specific care instructions. In general, we recommend following the care label, using gentle detergents, and avoiding tumble drying for natural fibres.' },
  { q: 'How is my measurement data used?', a: 'Saved measurements remain account data for future fit tools. The Phase 13 ML service is not yet connected, so VESTRA does not currently send measurements to a recommendation model.' },
  { q: 'How do promo codes work?', a: 'Enter your promo code at checkout. Some codes require a minimum spend or apply only to specific categories. Only one promo code can be used per order.' },
  { q: 'Do you offer student discount?', a: 'Yes, we offer 10% off for students through Student Beans. Verify your student status at checkout to apply the discount.' },
];

export function FaqPage() {
  const [query, setQuery] = useState('');
  const filtered = faqs.filter((f) => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="container-vestra py-12 lg:py-20">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <h1 className="font-display text-4xl lg:text-5xl mb-4">Frequently Asked Questions</h1>
        <p className="text-muted-foreground">Find answers to common questions about fit technology, orders, delivery, and more.</p>
      </div>

      <div className="max-w-2xl mx-auto mb-8 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search questions..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
      </div>

      <div className="max-w-2xl mx-auto">
        {filtered.length > 0 ? (
          <Accordion type="single" collapsible>
            {filtered.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-center text-muted-foreground py-8">No results found. Try a different search or contact us.</p>
        )}
      </div>
    </div>
  );
}
