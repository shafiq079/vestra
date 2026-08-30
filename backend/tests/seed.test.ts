import { describe, expect, it } from 'vitest';
import { Category, Collection, Product } from '../src/models'; import { CATALOGUE_COUNTS, seedCatalogue } from '../src/seed/catalogueSeed';
describe('catalogue seed', () => {
 it('loads 24 products and valid relationships', async () => { expect(await seedCatalogue()).toEqual(CATALOGUE_COUNTS); expect(await Product.countDocuments()).toBe(24); expect(await Category.countDocuments()).toBe(6); expect(await Collection.countDocuments()).toBe(3); const coat=await Product.findOne({slug:'heritage-wool-coat-camel'}); expect(coat?.variants).toHaveLength(10); expect(coat?.tryOnEligible).toBe(true); expect(coat?.sizeRecommendationEligible).toBe(true); const ids=new Set((await Product.find().select('_id')).map(p=>p.id)); for(const p of await Product.find()) for(const related of p.relatedProductIds) expect(ids.has(String(related))).toBe(true); });
 it('is deterministic and idempotent in replace mode', async () => { await seedCatalogue(); await seedCatalogue(); expect(await Product.countDocuments()).toBe(24); expect(await Category.countDocuments()).toBe(6); expect(await Collection.countDocuments()).toBe(3); });
});
