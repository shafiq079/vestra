import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Package, ShoppingCart, Users, Sparkles, Ruler, AlertTriangle, Info, XCircle } from 'lucide-react';
import { getDashboardMetrics, mockSalesData, mockTopProducts, mockRecentOrders, mockLowStockVariants, mockSystemIssues } from '@/services/adminService';
import { formatPrice } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function AdminDashboardPage() {
  const { data: metrics, isLoading } = useQuery({ queryKey: ['admin-dashboard'], queryFn: getDashboardMetrics });

  if (isLoading || !metrics) {
    return <div className="space-y-4"><div className="h-32 bg-muted rounded-xl animate-pulse" /><div className="grid md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div></div>;
  }

  const statCards = [
    { label: 'Revenue', value: formatPrice(metrics.revenue.total), change: metrics.revenue.change, icon: TrendingUp },
    { label: 'Orders', value: metrics.orders.total.toString(), change: metrics.orders.change, icon: ShoppingCart },
    { label: 'Avg Order Value', value: formatPrice(metrics.avgOrderValue.total), change: metrics.avgOrderValue.change, icon: Package },
    { label: 'Customers', value: metrics.customers.total.toLocaleString(), sub: `${metrics.customers.newThisMonth} new this month`, icon: Users },
    { label: 'VTO Usage', value: metrics.vtoUsage.total.toLocaleString(), sub: `${metrics.vtoUsage.helpfulRate}% helpful rate`, icon: Sparkles },
    { label: 'Size Rec Usage', value: metrics.sizeRecUsage.total.toLocaleString(), sub: `${metrics.sizeRecUsage.successRate}% success rate`, icon: Ruler },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl lg:text-3xl mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="min-w-0 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className="h-5 w-5 text-muted-foreground" />
              {stat.change !== undefined && (
                <span className={cn('text-xs font-medium flex items-center gap-0.5', stat.change >= 0 ? 'text-success' : 'text-destructive')}>
                  {stat.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stat.change)}%
                </span>
              )}
            </div>
            <p className="text-xl font-semibold sm:text-2xl break-words">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            {stat.sub && <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Revenue (Last 6 Months)</h2>
          <div className="space-y-3">
            {mockSalesData.map((d) => (
              <div key={d.month} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-8">{d.month}</span>
                <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                  <div className="h-full bg-foreground rounded" style={{ width: `${(d.revenue / 184250) * 100}%` }} />
                </div>
                <span className="text-xs font-medium w-16 text-right">{formatPrice(d.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Top Products</h2>
          <div className="space-y-3">
            {mockTopProducts.map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="text-sm font-medium flex-1 truncate">{p.productName}</span>
                <span className="text-xs text-muted-foreground">{p.unitsSold} sold</span>
                <span className="text-xs font-medium w-16 text-right">{formatPrice(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {mockRecentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div><p className="font-medium">{o.orderNumber}</p><p className="text-xs text-muted-foreground">{o.customer} · {o.date}</p></div>
                <div className="flex items-center gap-2"><Badge variant="secondary" className="capitalize">{o.status}</Badge><span className="font-medium">{formatPrice(o.total)}</span></div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Low Stock Alerts</h2>
            <div className="space-y-2">
              {mockLowStockVariants.map((v) => (
                <div key={v.sku} className="flex items-center justify-between text-sm">
                  <div><p className="font-medium">{v.productName}</p><p className="text-xs text-muted-foreground">{v.sku} · {v.colour} · {v.size}</p></div>
                  <Badge variant="destructive">{v.stock} left</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-4">System Status</h2>
            <div className="space-y-2">
              {mockSystemIssues.map((s) => (
                <div key={s.id} className="flex items-start gap-2 text-sm">
                  {s.severity === 'error' ? <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> : s.severity === 'warning' ? <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" /> : <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div><p className="text-muted-foreground">{s.message}</p><p className="text-xs text-muted-foreground mt-0.5">{s.time}</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
