import { useState, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Search,
  PackageOpen,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAdminInventory,
  updateVariantStock,
} from '@/services/adminService';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface FlatVariant {
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  sku: string;
  colour: string;
  colourHex: string;
  size: string;
  stock: number;
}

function stockBadge(stock: number) {
  if (stock === 0) {
    return (
      <Badge
        variant="destructive"
        className="whitespace-nowrap"
      >
        <span className="sm:hidden">
          Out
        </span>

        <span className="hidden sm:inline">
          Out of stock
        </span>
      </Badge>
    );
  }

  if (stock <= 5) {
    return (
      <Badge
        variant="secondary"
        className="whitespace-nowrap"
      >
        <AlertTriangle className="mr-1 hidden h-3 w-3 sm:block" />

        <span className="sm:hidden">
          Low
        </span>

        <span className="hidden sm:inline">
          Low stock
        </span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="default"
      className="whitespace-nowrap"
    >
      <CheckCircle className="mr-1 hidden h-3 w-3 sm:block" />

      <span className="sm:hidden">
        In
      </span>

      <span className="hidden sm:inline">
        In stock
      </span>
    </Badge>
  );
}

export function AdminInventoryPage() {
  const queryClient = useQueryClient();

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: getAdminInventory,
  });

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('0');

  const updateMutation = useMutation({
    mutationFn: ({
      productId,
      variantId,
      stock,
    }: {
      productId: string;
      variantId: string;
      stock: number;
    }) =>
      updateVariantStock(
        productId,
        variantId,
        stock
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-inventory'],
      });

      queryClient.invalidateQueries({
        queryKey: ['admin-products'],
      });

      queryClient.invalidateQueries({
        queryKey: ['products'],
      });

      toast.success('Stock updated');
      setEditingId(null);
    },
  });

  const flatVariants = useMemo<FlatVariant[]>(() => {
    if (!products) {
      return [];
    }

    const rows: FlatVariant[] = [];

    for (const product of products) {
      for (const variant of product.variants) {
        rows.push({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          variantId: variant.id,
          sku: variant.sku,
          colour: variant.colour,
          colourHex: variant.colourHex,
          size: variant.size,
          stock: variant.stock,
        });
      }
    }

    return rows;
  }, [products]);

  const filtered = useMemo(() => {
    if (!query) {
      return flatVariants;
    }

    const q = query.toLowerCase();

    return flatVariants.filter(
      (variant) =>
        variant.productName
          .toLowerCase()
          .includes(q) ||
        variant.sku
          .toLowerCase()
          .includes(q) ||
        variant.colour
          .toLowerCase()
          .includes(q)
    );
  }, [flatVariants, query]);

  const startEdit = (variant: FlatVariant) => {
    setEditingId(variant.variantId);
    setEditValue(String(variant.stock));
  };

  const saveEdit = (
    productId: string,
    variantId: string
  ) => {
    updateMutation.mutate({
      productId,
      variantId,
      stock: Number(editValue),
    });
  };

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <h1 className="font-display text-2xl lg:text-3xl">
          Inventory
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          View and adjust stock levels across all product variants.
        </p>
      </div>

      <div className="relative mb-4 w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          placeholder="Search by product, SKU or colour..."
          value={query}
          onChange={(e) =>
            setQuery(e.target.value)
          }
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-muted-foreground">
          Failed to load inventory.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

          <p className="font-medium">
            No variants found
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm sm:table-auto">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-[56%] px-3 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Product
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">
                    SKU
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">
                    Colour
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">
                    Size
                  </th>

                  <th className="w-[16%] px-2 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Stock
                  </th>

                  <th className="w-[28%] px-2 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((variant) => (
                  <tr
                    key={variant.variantId}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="min-w-0 px-3 py-3 sm:px-4">
                      <p className="font-medium leading-5">
                        {variant.productName}
                      </p>

                      <p className="mt-1 break-all text-xs text-muted-foreground sm:hidden">
                        {variant.sku} · {variant.size}
                      </p>
                    </td>

                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {variant.sku}
                    </td>

                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-border"
                          style={{
                            backgroundColor:
                              variant.colourHex,
                          }}
                        />

                        <span className="text-muted-foreground">
                          {variant.colour}
                        </span>
                      </div>
                    </td>

                    <td className="hidden px-4 py-3 sm:table-cell">
                      {variant.size}
                    </td>

                    <td className="px-2 py-3 sm:px-4">
                      {editingId ===
                      variant.variantId ? (
                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) =>
                              setEditValue(
                                e.target.value
                              )
                            }
                            className="h-8 w-14 sm:w-20"
                            autoFocus
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter'
                              ) {
                                saveEdit(
                                  variant.productId,
                                  variant.variantId
                                );
                              }

                              if (
                                e.key === 'Escape'
                              ) {
                                setEditingId(null);
                              }
                            }}
                          />

                          <button
                            onClick={() =>
                              saveEdit(
                                variant.productId,
                                variant.variantId
                              )
                            }
                            className="text-xs text-foreground hover:underline"
                          >
                            Save
                          </button>

                          <button
                            onClick={() =>
                              setEditingId(null)
                            }
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            startEdit(variant)
                          }
                          className="font-medium hover:underline"
                          aria-label={`Edit stock for ${variant.productName} ${variant.size}`}
                        >
                          {variant.stock}
                        </button>
                      )}
                    </td>

                    <td className="px-2 py-3 sm:px-4">
                      {stockBadge(variant.stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}