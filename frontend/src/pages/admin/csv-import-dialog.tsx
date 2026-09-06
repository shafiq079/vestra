import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileDown, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createAdminProduct, importAdminProducts } from '@/services/adminService';
import { USE_MOCK_API } from '@/services/apiClient';
import { slugify } from '@/utils/formatters';
import type { Product } from '@/types';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

const REQUIRED_FIELDS = ['name', 'slug', 'category', 'price', 'brand', 'genderCollection'];
const ALL_FIELDS = [...REQUIRED_FIELDS, 'shortDescription', 'salePrice', 'isPublished', 'colour', 'colourHex', 'size', 'sku', 'stock'];

function buildTemplate(): string {
  const header = ALL_FIELDS.join(',');
  const example = ['Silk Wrap Dress', 'silk-wrap-dress-midnight', 'dresses', '285', 'VESTRA', 'women', 'An elegant silk wrap dress', '', 'true', 'Midnight Blue', '#191970', 'S', 'SWD-MID-S', '9'];
  return `${header}\n${example.join(',')}`;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function validateRow(row: Record<string, string>, rowIndex: number): ParsedRow {
  const errors: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].trim() === '') errors.push(`Missing ${field}`);
  }
  if (row.price && isNaN(Number(row.price))) errors.push('Price must be a number');
  if (row.salePrice && row.salePrice !== '' && isNaN(Number(row.salePrice))) errors.push('Sale price must be a number');
  if (row.genderCollection && !['women', 'men', 'unisex'].includes(row.genderCollection)) errors.push('genderCollection must be women, men, or unisex');
  return { rowIndex, data: row, errors, valid: errors.length === 0 };
}

function rowToProduct(row: Record<string, string>): Omit<Product, 'id' | 'createdAt'> {
  const price = Number(row.price);
  const salePrice = row.salePrice && row.salePrice !== '' ? Number(row.salePrice) : undefined;
  const stock = row.stock ? Number(row.stock) : 0;
  const colour = row.colour || 'Default';
  const colourHex = row.colourHex || '#000000';
  const size = row.size || 'S';
  const sku = row.sku || `${slugify(row.name)}-${size}`.toUpperCase();
  const totalStock = stock;
  const stockStatus = totalStock === 0 ? 'out_of_stock' : totalStock <= 5 ? 'low_stock' : 'in_stock';
  return {
    name: row.name,
    brand: row.brand,
    slug: row.slug,
    shortDescription: row.shortDescription || '',
    fullDescription: row.shortDescription || '',
    category: row.category,
    subcategory: undefined,
    collection: undefined,
    genderCollection: row.genderCollection as Product['genderCollection'],
    price,
    salePrice: salePrice && salePrice > 0 ? salePrice : undefined,
    currency: 'GBP',
    images: [],
    lifestyleImages: [],
    colours: [colour],
    variants: [{ id: `v${Date.now()}${Math.random().toString(36).slice(2, 6)}`, sku, colour, colourHex, size, stock }],
    availableSizes: [size],
    materials: [],
    careInstructions: [],
    fitDescription: '',
    rating: 0,
    reviewCount: 0,
    stockStatus,
    badges: [],
    tryOnEligible: false,
    sizeRecommendationEligible: false,
    recommendationTags: [],
    relatedProductIds: [],
    isPublished: row.isPublished?.toLowerCase() === 'true',
  };
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      if (!USE_MOCK_API) {
        const result = await importAdminProducts(csvText);
        return result.imported as Product[];
      }
      const results: Product[] = [];
      for (const row of rows) {
        if (row.valid) {
          const product = await createAdminProduct(rowToProduct(row.data));
          results.push(product);
        }
      }
      return results;
    },
    onSuccess: (imported) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      toast.success(`${imported.length} product${imported.length !== 1 ? 's' : ''} imported`);
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Import failed'),
  });

  const handleClose = () => {
    setParsedRows([]);
    setFileName('');
    setCsvText('');
    onOpenChange(false);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvText(text);
      const rows = parseCsv(text);
      const validated = rows.map((r, i) => validateRow(r, i + 2));
      setParsedRows(validated);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  };

  const downloadTemplate = () => {
    const csv = buildTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vestra-product-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = parsedRows.filter((r) => r.valid);
  const errorRows = parsedRows.filter((r) => !r.valid);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>Upload a CSV file to import products in bulk. New products default to Draft unless the CSV sets isPublished to true.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileDown className="h-4 w-4 mr-2" /> Download CSV Template
          </Button>

          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{fileName || 'Drag and drop a CSV file, or click to select'}</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> {parsedRows.length} total rows</span>
                <span className="flex items-center gap-1.5 text-green-600"><CheckCircle className="h-4 w-4" /> {validRows.length} valid</span>
                {errorRows.length > 0 && <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" /> {errorRows.length} with errors</span>}
              </div>

              {errorRows.length > 0 && (
                <div className="space-y-2">
                  {errorRows.map((r) => (
                    <div key={r.rowIndex} className="text-xs p-2 bg-destructive/5 border border-destructive/20 rounded">
                      <span className="font-medium">Row {r.rowIndex}: {r.data.name || '(no name)'}</span>
                      <span className="text-destructive ml-2">{r.errors.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}

              {validRows.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-medium">Valid products to import</div>
                  <div className="max-h-40 overflow-y-auto">
                    {validRows.slice(0, 10).map((r) => (
                      <div key={r.rowIndex} className="px-3 py-2 text-xs border-t border-border flex items-center justify-between">
                        <span>{r.data.name}</span>
                        <Badge variant="outline" className="text-xs">{r.data.category}</Badge>
                      </div>
                    ))}
                    {validRows.length > 10 && <div className="px-3 py-2 text-xs text-muted-foreground">...and {validRows.length - 10} more</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button disabled={validRows.length === 0 || importMutation.isPending} onClick={() => importMutation.mutate(validRows)}>
            {importMutation.isPending ? 'Importing...' : `Import ${validRows.length} Product${validRows.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
