import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  Tag,
  PackageOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '@/services/adminService';
import { slugify } from '@/utils/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Category } from '@/types';

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();

  const {
    data: categories,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: getAdminCategories,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
    displayOrder: 0,
  });

  const createMutation = useMutation({
    mutationFn: (input: Omit<Category, 'id'>) =>
      createAdminCategory(input),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-categories'],
      });

      toast.success('Category created');
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Category>;
    }) => updateAdminCategory(id, updates),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-categories'],
      });

      toast.success('Category updated');
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminCategory(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-categories'],
      });

      toast.success('Category deleted');
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditTarget(null);

    setForm({
      name: '',
      slug: '',
      description: '',
      isActive: true,
      displayOrder: (categories?.length ?? 0) + 1,
    });

    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);

    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      isActive: cat.isActive,
      displayOrder: cat.displayOrder,
    });

    setDialogOpen(true);
  };

  const handleSave = () => {
    const slug = form.slug || slugify(form.name);

    if (!form.name || !slug) {
      toast.error('Name is required');
      return;
    }

    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        updates: {
          ...form,
          slug,
        },
      });
    } else {
      createMutation.mutate({
        ...form,
        slug,
        parentId: undefined,
        image: undefined,
      });
    }
  };

  const sorted = [...(categories ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl lg:text-3xl">
            Categories
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage product categories, active state and display order.
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-muted-foreground">
          Failed to load categories.
        </Card>
      ) : sorted.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

          <p className="font-medium">
            No categories yet
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Create your first category.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm sm:table-auto">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="hidden w-10 px-4 py-3 sm:table-cell" />

                  <th className="w-[45%] px-3 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Name
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">
                    Slug
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">
                    Description
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">
                    Order
                  </th>

                  <th className="w-[30%] px-2 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Status
                  </th>

                  <th className="w-[25%] px-2 py-3 sm:w-20 sm:px-4" />
                </tr>
              </thead>

              <tbody>
                {sorted.map((cat) => (
                  <tr
                    key={cat.id}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </td>

                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex min-w-0 items-start gap-2">
                        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                        <div className="min-w-0">
                          <span className="block truncate font-medium">
                            {cat.name}
                          </span>

                          <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                            Order {cat.displayOrder}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {cat.slug}
                    </td>

                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {cat.description || '—'}
                    </td>

                    <td className="hidden px-4 py-3 sm:table-cell">
                      {cat.displayOrder}
                    </td>

                    <td className="px-2 py-3 sm:px-4">
                      <Badge
                        variant={cat.isActive ? 'default' : 'outline'}
                        className="whitespace-nowrap"
                      >
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="px-1 py-3 sm:px-4">
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(cat)}
                          aria-label={`Edit ${cat.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(cat)}
                          aria-label={`Delete ${cat.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Edit Category' : 'Add Category'}
            </DialogTitle>

            <DialogDescription>
              {editTarget
                ? 'Update category details.'
                : 'Create a new product category.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">
                Name
              </Label>

              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">
                Slug
              </Label>

              <div className="flex gap-2">
                <Input
                  id="cat-slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value,
                    })
                  }
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      slug: slugify(form.name),
                    })
                  }
                >
                  Auto
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">
                Description
              </Label>

              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-order">
                Display Order
              </Label>

              <Input
                id="cat-order"
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({
                    ...form,
                    displayOrder: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">
                Active
              </Label>

              <Switch
                checked={form.isActive}
                onCheckedChange={(value) =>
                  setForm({
                    ...form,
                    isActive: value,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editTarget ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete category?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}".
              Products in this category will remain but lose their
              category association.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}