import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { Category, Collection, Product } from '../models';
import { catalogueProducts } from './data/catalogue';
import { catalogueCategories, catalogueCollections } from './data/taxonomy';

export const CATALOGUE_COUNTS = { products: 24, categories: 6, collections: 3 } as const;

/** Replaces the owned catalogue deterministically; unrelated database data is untouched. */
export async function seedCatalogue(): Promise<typeof CATALOGUE_COUNTS> {
  const productIds = new Map(catalogueProducts.map((product) => [product.id, new Types.ObjectId()]));
  const categoryIds = new Map(catalogueCategories.map((category) => [category.id, new Types.ObjectId()]));

  await Product.deleteMany({});
  await Category.deleteMany({});
  await Collection.deleteMany({});

  await Category.insertMany(catalogueCategories.map(({ id, parentId, ...category }) => ({
    _id: categoryIds.get(id), ...category, ...(parentId ? { parentId: categoryIds.get(parentId) } : {}),
  })) as never[]);
  await Collection.insertMany(catalogueCollections.map(({ id: _id, ...collection }) => collection));
  await Product.insertMany(catalogueProducts.map(({ id, relatedProductIds, createdAt, ...product }) => ({
    _id: productIds.get(id), ...product, relatedProductIds: relatedProductIds.map((legacyId) => productIds.get(legacyId)),
    createdAt: new Date(createdAt), updatedAt: new Date(createdAt),
  })) as never[]);
  return CATALOGUE_COUNTS;
}

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  try { const counts = await seedCatalogue(); process.stdout.write(`Seeded ${counts.products} products, ${counts.categories} categories, and ${counts.collections} collections.\n`); }
  finally { await disconnectDatabase(); }
}

if (require.main === module) main().catch(() => {
  process.stderr.write('Catalogue seed failed. Check the backend configuration and database availability.\n');
  process.exitCode = 1;
});
