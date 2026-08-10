import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Image as ImageIcon, CircleAlert as AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { createAdminProduct, updateAdminProduct } from '@/services/adminService';
import { slugify } from '@/utils/formatters';
import type { Product, ProductBadge, GenderCollection } from '@/types';

const variantSchema = z.object({
  id: z.string(),
  sku: z.string().min(1, 'SKU required'),
  colour: z.string().min(1, 'Colour required'),
  colourHex: z.string().min(1, 'Hex required'),
  size: z.string().min(1, 'Size required'),
  stock: z.coerce.number().int().min(0, 'Min 0'),
});

const imageSchema = z.object({
  id: z.string(),
  url: z.string().min(1, 'URL required'),
  alt: z.string(),
  position: z.coerce.number().int().min(0),
  isLifestyle: z.boolean(),
});

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  brand: z.string().min(1, 'Brand required'),
  slug: z.string().min(2, 'Slug required').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  shortDescription: z.string().min(10, 'Short description must be at least 10 characters'),
  fullDescription: z.string().min(20, 'Full description must be at least 20 characters'),
  genderCollection: z.enum(['women', 'men', 'unisex']),
  category: z.string().min(1, 'Category required'),
  subcategory: z.string().optional(),
  collection: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  salePrice: z.coerce.number().optional(),
  currency: z.string().default('GBP'),
  materials: z.array(z.string()),
  careInstructions: z.array(z.string()),
  fitDescription: z.string(),
  modelInformation: z.string().optional(),
  images: z.array(imageSchema),
  variants: z.array(variantSchema),
  tryOnEligible: z.boolean(),
  sizeRecommendationEligible: z.boolean(),
  sizeModelKey: z.string().optional(),
  isPublished: z.boolean(),
  badges: z.array(z.enum(['new', 'sale', 'low_stock', 'bestseller', 'exclusive'])),
}).refine((data) => {
  if (data.salePrice !== undefined && data.salePrice > 0 && data.salePrice >= data.price) return false;
  return true;
}, { message: 'Sale price must be less than regular price', path: ['salePrice'] })
  .refine((data) => {
    const skus = data.variants.map((v) => v.sku);
    return skus.length === new Set(skus).size;
  }, { message: 'Duplicate SKU values found', path: ['variants'] });

type FormValues = z.infer<typeof productSchema>;

const categoryOptions = ['dresses', 'tops', 'knitwear', 'trousers', 'outerwear', 'jumpsuits', 'activewear', 'skirts'];
const NO_COLLECTION_VALUE = '__none__';
const collectionOptions = ['autumn-edit', 'workwear-edit', 'weekend-essentials'];
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '30W 30L', '32W 30L', '34W 32L', '36W 32L'];
const badgeOptions: ProductBadge[] = ['new', 'sale', 'bestseller', 'exclusive'];
const sizeModelKeys = ['dresses_women', 'tops_women', 'knitwear_women', 'trousers_women', 'outerwear_women', 'outerwear_men', 'knitwear_men', 'shirts_men', 'trousers_men', 'jumpsuits_women', 'activewear_women'];

function genId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function productToFormValues(product: Product): FormValues {
  return {
    name: product.name,
    brand: product.brand,
    slug: product.slug,
    shortDescription: product.shortDescription,
    fullDescription: product.fullDescription,
    genderCollection: product.genderCollection,
    category: product.category,
    subcategory: product.subcategory || '',
    collection: product.collection || '',
    price: product.price,
    salePrice: product.salePrice,
    currency: product.currency,
    materials: product.materials,
    careInstructions: product.careInstructions,
    fitDescription: product.fitDescription,
    modelInformation: product.modelInformation || '',
    images: product.images.map((img) => ({ ...img, position: Number(img.position) })),
    variants: product.variants.map((v) => ({ ...v, stock: Number(v.stock) })),
    tryOnEligible: product.tryOnEligible,
    sizeRecommendationEligible: product.sizeRecommendationEligible,
    sizeModelKey: product.sizeModelKey || '',
    isPublished: product.isPublished,
    badges: product.badges,
  };
}

function formValuesToProduct(values: FormValues, existing?: Product): Omit<Product, 'id' | 'createdAt'> {
  const totalStock = values.variants.reduce((sum, v) => sum + v.stock, 0);
  const stockStatus = totalStock === 0 ? 'out_of_stock' : totalStock <= 5 ? 'low_stock' : 'in_stock';
  const colours = Array.from(new Set(values.variants.map((v) => v.colour)));
  const availableSizes = Array.from(new Set(values.variants.map((v) => v.size)));
  const lifestyleImages: typeof values.images = [];
  return {
    name: values.name,
    brand: values.brand,
    slug: values.slug,
    shortDescription: values.shortDescription,
    fullDescription: values.fullDescription,
    category: values.category,
    subcategory: values.subcategory || undefined,
    collection: values.collection || undefined,
    genderCollection: values.genderCollection as GenderCollection,
    price: values.price,
    salePrice: values.salePrice && values.salePrice > 0 ? values.salePrice : undefined,
    currency: values.currency,
    images: values.images.map((img, i) => ({ ...img, position: i })),
    lifestyleImages,
    colours,
    variants: values.variants,
    availableSizes,
    materials: values.materials,
    careInstructions: values.careInstructions,
    fitDescription: values.fitDescription,
    modelInformation: values.modelInformation || undefined,
    rating: existing?.rating ?? 0,
    reviewCount: existing?.reviewCount ?? 0,
    stockStatus,
    badges: values.badges,
    tryOnEligible: values.tryOnEligible,
    sizeRecommendationEligible: values.sizeRecommendationEligible,
    sizeModelKey: values.sizeRecommendationEligible ? values.sizeModelKey || undefined : undefined,
    recommendationTags: existing?.recommendationTags ?? [],
    relatedProductIds: existing?.relatedProductIds ?? [],
    isPublished: values.isPublished,
  };
}

interface ProductFormProps {
  product?: Product;
  mode: 'create' | 'edit';
}

export function ProductForm({ product, mode }: ProductFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [materialsInput, setMaterialsInput] = useState('');
  const [careInput, setCareInput] = useState('');

  const { control, register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(productSchema) as never,
    defaultValues: product ? productToFormValues(product) : {
      name: '', brand: 'VESTRA', slug: '', shortDescription: '', fullDescription: '',
      genderCollection: 'women', category: '', subcategory: '', collection: '',
      price: 0, salePrice: undefined, currency: 'GBP',
      materials: [], careInstructions: [], fitDescription: '', modelInformation: '',
      images: [], variants: [], tryOnEligible: false, sizeRecommendationEligible: false,
      sizeModelKey: '', isPublished: false, badges: [],
    },
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({ control, name: 'images' });
  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({ control, name: 'variants' });

  const nameValue = watch('name');

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const data = formValuesToProduct(values, product);
      if (mode === 'edit' && product) {
        return updateAdminProduct(product.id, data);
      }
      return createAdminProduct(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      toast.success(mode === 'edit' ? 'Product updated' : 'Product created');
      navigate('/admin/products');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save product');
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values as FormValues);

  const addMaterial = () => {
    if (!materialsInput.trim()) return;
    const current = watch('materials');
    if (!current.includes(materialsInput.trim())) setValue('materials', [...current, materialsInput.trim()]);
    setMaterialsInput('');
  };
  const removeMaterial = (idx: number) => setValue('materials', watch('materials').filter((_, i) => i !== idx));

  const addCare = () => {
    if (!careInput.trim()) return;
    const current = watch('careInstructions');
    if (!current.includes(careInput.trim())) setValue('careInstructions', [...current, careInput.trim()]);
    setCareInput('');
  };
  const removeCare = (idx: number) => setValue('careInstructions', watch('careInstructions').filter((_, i) => i !== idx));

  const toggleBadge = (badge: ProductBadge) => {
    const current = watch('badges');
    if (current.includes(badge)) setValue('badges', current.filter((b) => b !== badge));
    else setValue('badges', [...current, badge]);
  };

  const handleLocalImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      appendImage({ id: genId('img'), url: reader.result as string, alt: '', position: imageFields.length, isLifestyle: false });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* BASIC INFORMATION */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" {...register('brand')} />
            {errors.brand && <p className="text-xs text-destructive">{errors.brand.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex gap-2">
              <Input id="slug" {...register('slug')} />
              <Button type="button" variant="outline" onClick={() => setValue('slug', slugify(nameValue || ''))}>Auto</Button>
            </div>
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="genderCollection">Gender Collection</Label>
            <Select defaultValue={watch('genderCollection')} onValueChange={(v) => setValue('genderCollection', v as GenderCollection)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="women">Women</SelectItem>
                <SelectItem value="men">Men</SelectItem>
                <SelectItem value="unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={watch('category')} onValueChange={(v) => setValue('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subcategory">Subcategory (optional)</Label>
            <Input id="subcategory" {...register('subcategory')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collection">Collection (optional)</Label>
            <Select value={watch('collection') || NO_COLLECTION_VALUE} onValueChange={(v) => setValue('collection', v === NO_COLLECTION_VALUE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COLLECTION_VALUE}>None</SelectItem>
                {collectionOptions.map((c) => <SelectItem key={c} value={c}>{c.replace(/-/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shortDescription">Short Description</Label>
          <Input id="shortDescription" {...register('shortDescription')} />
          {errors.shortDescription && <p className="text-xs text-destructive">{errors.shortDescription.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullDescription">Full Description</Label>
          <Textarea id="fullDescription" rows={4} {...register('fullDescription')} />
          {errors.fullDescription && <p className="text-xs text-destructive">{errors.fullDescription.message}</p>}
        </div>
      </section>

      <Separator />

      {/* MEDIA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Media</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendImage({ id: genId('img'), url: '', alt: '', position: imageFields.length, isLifestyle: false })}>
            <Plus className="h-4 w-4 mr-1" /> Add Image URL
          </Button>
        </div>
        <div className="space-y-3">
          {imageFields.map((field, idx) => (
            <div key={field.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {watch(`images.${idx}.url`) ? <img src={watch(`images.${idx}.url`)} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Image URL" {...register(`images.${idx}.url`)} />
                <Input placeholder="Alt text" {...register(`images.${idx}.alt`)} />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(idx)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {imageFields.length === 0 && <p className="text-sm text-muted-foreground">No images added yet.</p>}
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground">Local file preview (prototype only):</Label>
          <Input type="file" accept="image/*" onChange={handleLocalImage} className="max-w-xs text-sm" />
        </div>
      </section>

      <Separator />

      {/* PRICING */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="price">Regular Price</Label>
            <Input id="price" type="number" step="0.01" {...register('price')} />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salePrice">Sale Price (optional)</Label>
            <Input id="salePrice" type="number" step="0.01" {...register('salePrice')} />
            {errors.salePrice && <p className="text-xs text-destructive">{errors.salePrice.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value="GBP" disabled {...register('currency')} />
          </div>
        </div>
      </section>

      <Separator />

      {/* PRODUCT DETAILS */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Product Details</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Materials</Label>
            <div className="flex gap-2 mt-1">
              <Input value={materialsInput} onChange={(e) => setMaterialsInput(e.target.value)} placeholder="e.g. 100% Cotton" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(); } }} />
              <Button type="button" variant="outline" onClick={addMaterial}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {watch('materials').map((m, i) => <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeMaterial(i)}>{m} ×</Badge>)}
            </div>
          </div>
          <div>
            <Label className="text-sm">Care Instructions</Label>
            <div className="flex gap-2 mt-1">
              <Input value={careInput} onChange={(e) => setCareInput(e.target.value)} placeholder="e.g. Machine wash at 30°C" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCare(); } }} />
              <Button type="button" variant="outline" onClick={addCare}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {watch('careInstructions').map((c, i) => <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeCare(i)}>{c} ×</Badge>)}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fitDescription">Fit Description</Label>
            <Input id="fitDescription" {...register('fitDescription')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="modelInformation">Model Information (optional)</Label>
            <Input id="modelInformation" {...register('modelInformation')} />
          </div>
        </div>
      </section>

      <Separator />

      {/* VARIANTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Variants</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => appendVariant({ id: genId('v'), sku: '', colour: '', colourHex: '#000000', size: 'S', stock: 0 })}>
            <Plus className="h-4 w-4 mr-1" /> Add Variant
          </Button>
        </div>
        {errors.variants?.root?.message && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.variants.root.message}</p>}
        <div className="space-y-2">
          {variantFields.map((field, idx) => (
            <div key={field.id} className="flex items-center gap-2 p-3 border border-border rounded-lg">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input placeholder="SKU" {...register(`variants.${idx}.sku`)} className="flex-1" />
              <Input placeholder="Colour" {...register(`variants.${idx}.colour`)} className="flex-1" />
              <Input type="color" {...register(`variants.${idx}.colourHex`)} className="w-12 h-9 p-1" />
              <Select value={watch(`variants.${idx}.size`)} onValueChange={(v) => setValue(`variants.${idx}.size`, v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder="Stock" {...register(`variants.${idx}.stock`)} className="w-20" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(idx)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {variantFields.length === 0 && <p className="text-sm text-muted-foreground">No variants added yet.</p>}
        </div>
      </section>

      <Separator />

      {/* AI FEATURES */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">AI Features</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="tryOnEligible">Virtual Try-On Eligible</Label>
            <Controller control={control} name="tryOnEligible" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sizeRecommendationEligible">Size Recommendation Eligible</Label>
            <Controller control={control} name="sizeRecommendationEligible" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
          {watch('sizeRecommendationEligible') && (
            <div className="space-y-1.5">
              <Label htmlFor="sizeModelKey">Size Model Key</Label>
              <Select value={watch('sizeModelKey') || ''} onValueChange={(v) => setValue('sizeModelKey', v)}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>{sizeModelKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* PUBLISHING */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Publishing</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="isPublished">Published (uncheck for Draft)</Label>
          <Controller control={control} name="isPublished" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        </div>
        <div>
          <Label className="text-sm">Badges</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {badgeOptions.map((b) => (
              <Badge key={b} variant={watch('badges').includes(b) ? 'default' : 'outline'} className="cursor-pointer capitalize" onClick={() => toggleBadge(b)}>{b}</Badge>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Product'}</Button>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/products')}>Cancel</Button>
      </div>
    </form>
  );
}
