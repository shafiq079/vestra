import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSizeFormSchema, submitSizeRecommendation } from '@/services/sizeRecommendationService';
import type {
  Product,
  SizeRecommendationFormField,
  SizeRecommendationResult,
} from '@/types';
import { errorMessage } from '@/utils/errorMessage';
import { cn } from '@/lib/utils';

interface SizeRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSelectSize: (size: string) => void;
}

type UnitSystem = 'metric' | 'imperial';
type PreferredFit = 'fitted' | 'regular' | 'relaxed';

const KG_TO_LB = 2.2046226218;
const CM_TO_IN = 1 / 2.54;

function fieldUnit(field: SizeRecommendationFormField, unitSystem: UnitSystem): string | undefined {
  if (unitSystem === 'imperial' && field.unit === 'kg') return 'lb';
  if (unitSystem === 'imperial' && field.unit === 'cm') return 'in';
  return field.unit;
}

function displayBound(value: number | undefined, field: SizeRecommendationFormField, unitSystem: UnitSystem): number | undefined {
  if (value === undefined || unitSystem === 'metric') return value;
  if (field.unit === 'kg') return Math.round(value * KG_TO_LB * 10) / 10;
  if (field.unit === 'cm') return Math.round(value * CM_TO_IN * 10) / 10;
  return value;
}

function confidenceClass(label: SizeRecommendationResult['confidenceLabel']): string {
  if (label === 'High') return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
  if (label === 'Medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-muted text-muted-foreground';
}

function MeasurementField({
  field,
  value,
  unitSystem,
  onChange,
}: {
  field: SizeRecommendationFormField;
  value: number | string | undefined;
  unitSystem: UnitSystem;
  onChange: (value: number | string) => void;
}) {
  const unit = fieldUnit(field, unitSystem);
  const min = displayBound(field.min, field, unitSystem);
  const max = displayBound(field.max, field, unitSystem);

  if (field.inputType === 'select') {
    return (
      <div className="space-y-2">
        <Label htmlFor={`size-rec-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
        <select
          id={`size-rec-${field.key}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      </div>
    );
  }

  if (field.inputType === 'radio') {
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{field.label}{field.required ? ' *' : ''}</legend>
        <div className="flex flex-wrap gap-2">
          {field.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                value === option.value ? 'border-foreground bg-foreground text-background' : 'border-border',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      </fieldset>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`size-rec-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
      <div className="relative">
        <Input
          id={`size-rec-${field.key}`}
          type="number"
          inputMode="decimal"
          value={typeof value === 'number' || typeof value === 'string' ? value : ''}
          min={min}
          max={max}
          step={field.key === 'age' ? 1 : 0.1}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
          className={unit ? 'pr-14' : undefined}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {field.helpText}
        {(min !== undefined || max !== undefined) && (
          <span>{field.helpText ? ' ' : ''}{min !== undefined && max !== undefined ? `Range: ${min}–${max}${unit ? ` ${unit}` : ''}.` : ''}</span>
        )}
      </p>
    </div>
  );
}

export function SizeRecommendationDialog({ open, onOpenChange, product, onSelectSize }: SizeRecommendationDialogProps) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [preferredFit, setPreferredFit] = useState<PreferredFit>('regular');
  const [measurements, setMeasurements] = useState<Record<string, number | string>>({});
  const [result, setResult] = useState<SizeRecommendationResult | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schemaQuery = useQuery({
    queryKey: ['size-recommendation-schema', product.id],
    queryFn: () => getSizeFormSchema(product.id),
    enabled: open && product.sizeRecommendationEligible,
    retry: 1,
  });

  const fields = useMemo(
    () => [...(schemaQuery.data?.fields ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [schemaQuery.data?.fields],
  );

  useEffect(() => {
    setMeasurements({});
    setResult(null);
    setSubmitError('');
    setPreferredFit('regular');
    setUnitSystem('metric');
  }, [product.id]);

  const changeUnits = (next: UnitSystem) => {
    if (next === unitSystem) return;
    setUnitSystem(next);
    setMeasurements({});
    setResult(null);
    setSubmitError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    setResult(null);
    setIsSubmitting(true);
    try {
      const normalized: Record<string, number | string> = {};
      for (const field of fields) {
        const raw = measurements[field.key];
        if (raw === undefined || raw === '') continue;
        normalized[field.key] = field.inputType === 'number' ? Number(raw) : raw;
      }
      const recommendation = await submitSizeRecommendation({
        productId: product.id,
        measurements: normalized,
        preferredFit,
        unitSystem,
      });
      setResult(recommendation);
    } catch (error) {
      setSubmitError(errorMessage(error, 'Size recommendation is temporarily unavailable. Please select a size manually.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyRecommendation = () => {
    if (!result) return;
    onSelectSize(result.recommendedSize);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ruler className="h-5 w-5" /> Find My Size</DialogTitle>
          <DialogDescription>
            Enter your measurements and our Decision Tree model will estimate a suitable size for {product.name}.
          </DialogDescription>
        </DialogHeader>

        {schemaQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading size model…
          </div>
        )}

        {schemaQuery.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Size recommendation is unavailable right now.</p>
            <p className="mt-1 text-muted-foreground">You can still choose a size manually and continue shopping.</p>
          </div>
        )}

        {schemaQuery.data && (
          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <div className="space-y-2">
              <Label>Units</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={unitSystem === 'metric' ? 'default' : 'outline'} onClick={() => changeUnits('metric')}>Metric (kg / cm)</Button>
                <Button type="button" variant={unitSystem === 'imperial' ? 'default' : 'outline'} onClick={() => changeUnits('imperial')}>Imperial (lb / in)</Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <MeasurementField
                  key={field.key}
                  field={field}
                  value={measurements[field.key]}
                  unitSystem={unitSystem}
                  onChange={(value) => {
                    setMeasurements((current) => ({ ...current, [field.key]: value }));
                    setResult(null);
                    setSubmitError('');
                  }}
                />
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="size-rec-fit">Preferred fit</Label>
              <select
                id="size-rec-fit"
                value={preferredFit}
                onChange={(event) => setPreferredFit(event.target.value as PreferredFit)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="fitted">Fitted</option>
                <option value="regular">Regular</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </div>

            {submitError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{submitError}</div>
            )}

            {result && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Recommended size</p>
                    <p className="font-display text-4xl mt-1">{result.recommendedSize}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-medium', confidenceClass(result.confidenceLabel))}>
                    {result.confidenceLabel} confidence · {result.confidencePercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm">{result.explanation}</p>
                {result.alternativeSize && <p className="mt-2 text-sm text-muted-foreground">Alternative to consider: {result.alternativeSize}</p>}
                {result.productNote && <p className="mt-2 text-sm text-muted-foreground">{result.productNote}</p>}
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  {Object.entries(result.measurementSummary).map(([label, value]) => <span key={label} className="mr-3">{label}: {value}</span>)}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{result.disclaimer}</p>
              </div>
            )}

            <DialogFooter>
              {result ? (
                <Button type="button" onClick={applyRecommendation}>Use size {result.recommendedSize}</Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</> : 'Recommend My Size'}
                </Button>
              )}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
