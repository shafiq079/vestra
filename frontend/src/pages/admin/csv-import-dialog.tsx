import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileDown, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { importAdminProducts, type CsvImportResult } from '@/services/adminService';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUIRED_FIELDS = ['name', 'slug', 'category', 'price', 'brand', 'genderCollection'];
const ALL_FIELDS = [...REQUIRED_FIELDS, 'shortDescription', 'salePrice', 'isPublished', 'colour', 'colourHex', 'size', 'sku', 'stock'];

function buildTemplate(): string {
  const header = ALL_FIELDS.join(',');
  const example = ['Silk Wrap Dress', 'silk-wrap-dress-midnight', 'dresses', '285', 'VESTRA', 'women', 'An elegant silk wrap dress', '', 'true', 'Midnight Blue', '#191970', 'S', 'SWD-MID-S', '9'];
  return `${header}\n${example.join(',')}`;
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [serverResult, setServerResult] = useState<CsvImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async () => importAdminProducts(csvText),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      toast.success(`${result.importedCount} product${result.importedCount !== 1 ? 's' : ''} imported`);
      if (result.errorCount > 0) setServerResult(result);
      else handleClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Import failed'),
  });

  const handleClose = () => {
    setFileName('');
    setCsvText('');
    setServerResult(null);
    onOpenChange(false);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvText(text);
      setServerResult(null);
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

          {csvText && !serverResult && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Ready for secure server validation</div>
          )}
          {serverResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> {serverResult.totalRows} total rows</span>
                <span className="flex items-center gap-1.5 text-green-600"><CheckCircle className="h-4 w-4" /> {serverResult.importedCount} imported</span>
                <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" /> {serverResult.errorCount} with errors</span>
              </div>
              {serverResult.errors.map((error) => (
                <div key={error.row} className="text-xs p-2 bg-destructive/5 border border-destructive/20 rounded">
                  <span className="font-medium">Row {error.row}:</span>
                  <span className="text-destructive ml-2">{error.errors.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button disabled={!csvText || importMutation.isPending} onClick={() => importMutation.mutate()}>
            {importMutation.isPending ? 'Importing...' : 'Import CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
