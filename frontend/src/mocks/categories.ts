import type { Category, Collection } from '../types';

export const mockCategories: Category[] = [
  { id: 'c1', name: 'Women', slug: 'women', parentId: undefined, image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', description: 'Women\'s fashion collection', isActive: true, displayOrder: 1 },
  { id: 'c2', name: 'Men', slug: 'men', parentId: undefined, image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=800&q=80', description: 'Men\'s fashion collection', isActive: true, displayOrder: 2 },
  { id: 'c3', name: 'Dresses', slug: 'dresses', parentId: 'c1', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80', description: 'Dresses for every occasion', isActive: true, displayOrder: 3 },
  { id: 'c4', name: 'Tops', slug: 'tops', parentId: 'c1', image: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=800&q=80', description: 'Tops and blouses', isActive: true, displayOrder: 4 },
  { id: 'c5', name: 'Outerwear', slug: 'outerwear', parentId: undefined, image: 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?w=800&q=80', description: 'Coats and jackets', isActive: true, displayOrder: 5 },
  { id: 'c6', name: 'Knitwear', slug: 'knitwear', parentId: undefined, image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80', description: 'Knitwear and jumpers', isActive: true, displayOrder: 6 },
];

export const mockCollections: Collection[] = [
  {
    id: 'col1',
    name: 'Autumn Edit',
    slug: 'autumn-edit',
    description:
      'Rich textures and warm layers for the new season. Curated pieces that transition effortlessly from crisp mornings to golden evenings.',
    image: '/images/collections/autumn-edit.jpg',
    season: 'Autumn 2024',
    isActive: true,
  },
  {
    id: 'col2',
    name: 'The Workwear Edit',
    slug: 'workwear-edit',
    description:
      'Tailored essentials for the modern professional. Sharp lines, considered fabrics, and versatile pieces that work as hard as you do.',
    image: '/images/collections/workwear-edit.jpg',
    season: 'Year-round',
    isActive: true,
  },
  {
    id: 'col3',
    name: 'Weekend Essentials',
    slug: 'weekend-essentials',
    description:
      'Relaxed silhouettes and easy-wear fabrics for your downtime. Comfortable pieces that never compromise on style.',
    image: '/images/collections/weekend-essentials.jpg',
    season: 'Year-round',
    isActive: true,
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return mockCategories.find((c) => c.slug === slug);
}

export function getCollectionBySlug(slug: string): Collection | undefined {
  return mockCollections.find((c) => c.slug === slug);
}

export function getSubcategories(parentId: string): Category[] {
  return mockCategories.filter((c) => c.parentId === parentId);
}
