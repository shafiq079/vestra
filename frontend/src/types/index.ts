// ============================================================
// VESTRA — Comprehensive TypeScript Type Definitions
// ============================================================

// ── User types ───────────────────────────────────────────────

export type UserRole = 'customer' | 'admin';

export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  isDefault: boolean;
}

export interface MeasurementProfile {
  id: string;
  userId: string;
  height?: number;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  inseam?: number;
  ageRange?: string;
  bodyProfile?: string;
  preferredFit?: 'fitted' | 'regular' | 'relaxed';
  unitSystem: 'metric' | 'imperial';
  lastUpdated: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  addresses: Address[];
  measurementProfile?: MeasurementProfile;
  wishlistIds: string[];
  createdAt: string;
  isActive: boolean;
  marketingOptIn: boolean;
}

// ── Product types ─────────────────────────────────────────────

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type GenderCollection = 'women' | 'men' | 'unisex';
export type ProductBadge = 'new' | 'sale' | 'low_stock' | 'bestseller' | 'exclusive';

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
  isLifestyle: boolean;
  colour?: string;
  isTryOnReady?: boolean;
  cloudinaryAssetId?: string;
  cloudinaryPublicId?: string;
  cloudinaryVersion?: number;
  cloudinaryFormat?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  colour: string;
  colourHex: string;
  size: string;
  stock: number;
  image?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  image?: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  season?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  subcategory?: string;
  collection?: string;
  genderCollection: GenderCollection;
  price: number;
  salePrice?: number;
  currency: string;
  images: ProductImage[];
  lifestyleImages: ProductImage[];
  colours: string[];
  variants: ProductVariant[];
  availableSizes: string[];
  materials: string[];
  careInstructions: string[];
  fitDescription: string;
  modelInformation?: string;
  rating: number;
  reviewCount: number;
  stockStatus: StockStatus;
  badges: ProductBadge[];
  tryOnEligible: boolean;
  sizeRecommendationEligible: boolean;
  sizeModelKey?: string;
  recommendationTags: string[];
  relatedProductIds: string[];
  isPublished: boolean;
  createdAt: string;
}

// ── Review types ──────────────────────────────────────────────

export type FitFeedback = 'runs_small' | 'true_to_size' | 'runs_large';

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  isVerified: boolean;
  rating: number;
  title: string;
  body: string;
  fitFeedback?: FitFeedback;
  helpfulCount: number;
  createdAt: string;
  isApproved: boolean;
  isReported: boolean;
}

// ── Cart types ────────────────────────────────────────────────

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  variantId: string;
  colour: string;
  size: string;
  quantity: number;
  price: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  deliveryOption?: DeliveryOption;
  estimatedTotal: number;
}

// ── Wishlist ──────────────────────────────────────────────────

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  addedAt: string;
}

// ── Order types ───────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface DeliveryOption {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  brand: string;
  colour: string;
  size: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  guestEmail?: string;
  items: OrderItem[];
  shippingAddress: Address;
  deliveryOption: DeliveryOption;
  subtotal: number;
  discount: number;
  deliveryCost: number;
  total: number;
  promoCode?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery: string;
}

// ── Recommendations ───────────────────────────────────────────

export type RecommendationType =
  | 'recommended_for_you'
  | 'similar_styles'
  | 'complete_the_look'
  | 'frequently_bought_together'
  | 'based_on_recently_viewed'
  | 'inspired_by_wishlist'
  | 'trending_in_your_size'
  | 'new_arrivals_you_may_like'
  | 'trending';

export interface RecommendationItem {
  productId: string;
  product: Product;
  score: number;
  explanation: string;
  sourceContext?: string;
}

export interface RecommendationGroup {
  id: string;
  type: RecommendationType;
  title: string;
  subtitle?: string;
  items: RecommendationItem[];
  isActive: boolean;
  placement: string;
}

// ── Size recommendation ───────────────────────────────────────

export interface SizeRecommendationFormField {
  key: string;
  label: string;
  inputType: 'number' | 'select' | 'radio';
  required: boolean;
  min?: number;
  max?: number;
  unit?: string;
  helpText?: string;
  displayOrder: number;
  options?: { value: string; label: string }[];
}

export interface SizeRecommendationFormSchema {
  productId: string;
  sizeModelKey: string;
  fields: SizeRecommendationFormField[];
}

export interface SizeRecommendationRequest {
  productId: string;
  measurements: Record<string, number | string>;
  preferredFit?: 'fitted' | 'regular' | 'relaxed';
  unitSystem: 'metric' | 'imperial';
}

export interface SizeRecommendationResult {
  productId: string;
  recommendedSize: string;
  confidencePercent: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  expectedFit: 'fitted' | 'regular' | 'relaxed';
  explanation: string;
  alternativeSize?: string;
  productNote?: string;
  measurementSummary: Record<string, string>;
  disclaimer: string;
}

// ── Virtual Try-On ────────────────────────────────────────────

export type VTOStatus =
  | 'idle'
  | 'consent'
  | 'upload'
  | 'review'
  | 'processing'
  | 'result'
  | 'error';

export interface VirtualTryOnRequest {
  productId: string;
  variantColour: string;
  imageFile: File;
  consentGiven: boolean;
}

export interface VirtualTryOnResult {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  resultImage: string;
  colour: string;
  createdAt: string;
  isDemo: boolean;
  feedbackGiven?: 'helpful' | 'not_helpful';
}

export type VirtualTryOnJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface VirtualTryOnJob {
  id: string;
  status: VirtualTryOnJobStatus;
  productId: string;
  productName: string;
  productImage: string;
  colour: string;
  createdAt: string;
  updatedAt: string;
  deadlineAt: string;
  isDemo: false;
  resultImage?: string;
  resultExpiresAt?: string;
  feedbackGiven?: 'helpful' | 'not_helpful';
  accessToken?: string;
  error?: { code: string; message: string };
}

// ── Admin ─────────────────────────────────────────────────────

export interface AdminDashboardMetrics {
  revenue: { total: number; change: number; period: string };
  orders: { total: number; change: number; period: string };
  avgOrderValue: { total: number; change: number };
  customers: { total: number; newThisMonth: number };
  products: { total: number; published: number; lowStock: number };
  vtoUsage: { total: number; helpfulRate: number };
  sizeRecUsage: { total: number; successRate: number };
}

// ── API helpers ───────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface FilterState {
  category?: string[];
  size?: string[];
  colour?: string[];
  minPrice?: number;
  maxPrice?: number;
  brand?: string[];
  fit?: string[];
  rating?: number;
  availability?: boolean;
  onSale?: boolean;
  tryOnEligible?: boolean;
  sizeRecEligible?: boolean;
  genderCollection?: GenderCollection;
  search?: string;
  sortBy?: SortOption;
}

export type SortOption =
  | 'recommended'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating'
  | 'bestselling';
