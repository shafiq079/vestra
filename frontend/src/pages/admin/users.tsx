import { useQuery } from '@tanstack/react-query';
import { getAdminUsers } from '@/services/adminService';
import {
  formatDate,
  initials,
} from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import type { User } from '@/types';

export function AdminUsersPage() {
  const {
    data: users,
    isLoading,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  return (
    <div className="min-w-0">
      <h1 className="mb-6 font-display text-2xl lg:text-3xl">
        Customers
      </h1>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : (
        <Card className="overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm sm:table-auto">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-[70%] px-3 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Customer
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">
                    Joined
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">
                    Orders
                  </th>

                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">
                    Role
                  </th>

                  <th className="w-[30%] px-2 py-3 text-left font-semibold sm:w-auto sm:px-4">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {(users as User[] | undefined)?.map(
                  (user: User) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-muted/30"
                    >
                      <td className="min-w-0 px-3 py-3 sm:px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage
                              src={user.avatar}
                            />

                            <AvatarFallback>
                              {initials(
                                user.firstName,
                                user.lastName
                              )}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {user.firstName}{' '}
                              {user.lastName}
                            </p>

                            <p className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </p>

                            <p className="mt-1 text-xs capitalize text-muted-foreground sm:hidden">
                              {user.role}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {user.wishlistIds.length}
                      </td>

                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge
                          variant={
                            user.role === 'admin'
                              ? 'default'
                              : 'outline'
                          }
                          className="capitalize"
                        >
                          {user.role}
                        </Badge>
                      </td>

                      <td className="px-2 py-3 sm:px-4">
                        <Badge
                          variant={
                            user.isActive
                              ? 'default'
                              : 'destructive'
                          }
                          className="whitespace-nowrap"
                        >
                          {user.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}