import { Sparkles, Ruler, Camera, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '@/services/adminService';

export function AdminAiFeaturesPage() {
  const { data: dashboard } = useQuery({ queryKey: ['admin-dashboard'], queryFn: getDashboardMetrics });
  const features = [
    {
      name: 'Size Recommendation Engine',
      icon: Ruler,
      status: 'inactive',
      description: 'The Phase 13 ML model has not been supplied, so size recommendation is currently unavailable.',
      metrics: [
        { label: 'Total Requests', value: String(dashboard?.sizeRecUsage.total ?? 0) },
        { label: 'Success Rate', value: `${dashboard?.sizeRecUsage.successRate ?? 0}%` },
        { label: 'Status', value: 'Unavailable' },
      ],
    },
    {
      name: 'Virtual Try-On',
      icon: Camera,
      status: 'active',
      description: 'Server-mediated Pixelcut previews using temporary private Cloudinary source storage.',
      metrics: [
        { label: 'Completed', value: String(dashboard?.vtoUsage.total ?? 0) },
        { label: 'Helpful Rate', value: `${dashboard?.vtoUsage.helpfulRate ?? 0}%` },
        { label: 'Provider', value: 'Pixelcut' },
      ],
    },
    {
      name: 'Product Recommendations',
      icon: Sparkles,
      status: 'active',
      description: 'Deterministic catalogue, order, wishlist and purchase-signal recommendations from Phase 9.',
      metrics: [
        { label: 'Strategies', value: '9' },
        { label: 'External AI', value: 'None' },
        { label: 'Status', value: 'Active' },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-6 w-6 text-ai" />
        <h1 className="font-display text-2xl lg:text-3xl">AI Features</h1>
      </div>

      <div className="space-y-6">
        {features.map((f) => (
          <Card key={f.name} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-ai-background flex items-center justify-center shrink-0"><f.icon className="h-5 w-5 text-ai" /></div>
                <div>
                  <h2 className="font-semibold">{f.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{f.description}</p>
                </div>
              </div>
              <Badge variant={f.status === 'active' ? 'default' : 'outline'} className="flex items-center gap-1">
                {f.status === 'active' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {f.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              {f.metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-lg font-semibold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Model Health</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Size Recommendation Model</span>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">●</span><span className="text-xs">Unavailable until Phase 13</span></div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Virtual Try-On Provider</span>
            <div className="flex items-center gap-2"><span className="text-success">●</span><span className="text-xs">Server integration configured</span></div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Recommendation Pipeline</span>
            <div className="flex items-center gap-2"><span className="text-success">●</span><span className="text-xs">Operational</span></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
