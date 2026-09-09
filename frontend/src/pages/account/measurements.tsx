import { useState } from 'react';
import { Ruler, Save } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import type { MeasurementProfile } from '@/types';
import { updateMeasurementProfile } from '@/services/profileService';

export function AccountMeasurementsPage() {
  const user = useAuthStore((s) => s.user);
  const existing = user?.measurementProfile;
  const [form, setForm] = useState({
    height: existing?.height?.toString() || '',
    weight: existing?.weight?.toString() || '',
    chest: existing?.chest?.toString() || '',
    waist: existing?.waist?.toString() || '',
    hips: existing?.hips?.toString() || '',
    inseam: existing?.inseam?.toString() || '',
    ageRange: existing?.ageRange || '',
    preferredFit: existing?.preferredFit || 'regular',
    unitSystem: existing?.unitSystem || 'metric',
  });

  const replaceUser = useAuthStore((s) => s.replaceUser);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile: MeasurementProfile = {
      id: existing?.id || `mp${Date.now()}`,
      userId: user?.id || '',
      height: form.height ? Number(form.height) : undefined,
      weight: form.weight ? Number(form.weight) : undefined,
      chest: form.chest ? Number(form.chest) : undefined,
      waist: form.waist ? Number(form.waist) : undefined,
      hips: form.hips ? Number(form.hips) : undefined,
      inseam: form.inseam ? Number(form.inseam) : undefined,
      ageRange: form.ageRange || undefined,
      preferredFit: form.preferredFit as 'fitted' | 'regular' | 'relaxed',
      unitSystem: form.unitSystem as 'metric' | 'imperial',
      lastUpdated: new Date().toISOString(),
    };
    const { id: _id, userId: _userId, lastUpdated: _lastUpdated, ...payload } = profile;
    const saved = await updateMeasurementProfile(payload);
    if (user) replaceUser({ ...user, measurementProfile: saved });
    toast.success('Measurements saved');
  };

  const unit = form.unitSystem === 'metric' ? 'cm' : 'in';

  return (
    <div>
      <h1 className="font-display text-2xl lg:text-3xl mb-2">My Measurements</h1>
      <p className="text-muted-foreground mb-6 max-w-2xl">Save and update your measurements here. Automated ML size recommendation is not available until Phase 13.</p>

      {(!existing || Object.keys(existing).length === 0) && (
        <div className="bg-ai-background text-sm p-4 rounded-lg mb-6 flex items-start gap-3">
          <Ruler className="h-5 w-5 text-ai shrink-0 mt-0.5" />
          <p>No measurements saved yet. You can add them below for future fit tools.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        <div>
          <Label className="mb-3 block">Unit System</Label>
          <RadioGroup value={form.unitSystem} onValueChange={(v) => setForm({ ...form, unitSystem: v as 'metric' | 'imperial' })} className="flex gap-6">
            <div className="flex items-center gap-2"><RadioGroupItem value="metric" id="metric" /><Label htmlFor="metric">Metric (cm, kg)</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="imperial" id="imperial" /><Label htmlFor="imperial">Imperial (in, lb)</Label></div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><Label htmlFor="height">Height ({unit})</Label><Input id="height" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="weight">Weight ({form.unitSystem === 'metric' ? 'kg' : 'lb'})</Label><Input id="weight" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="chest">Chest ({unit})</Label><Input id="chest" type="number" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="waist">Waist ({unit})</Label><Input id="waist" type="number" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="hips">Hips ({unit})</Label><Input id="hips" type="number" value={form.hips} onChange={(e) => setForm({ ...form, hips: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="inseam">Inseam ({unit})</Label><Input id="inseam" type="number" value={form.inseam} onChange={(e) => setForm({ ...form, inseam: e.target.value })} className="mt-1" /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ageRange">Age Range</Label>
            <Select value={form.ageRange} onValueChange={(v) => setForm({ ...form, ageRange: v })}>
              <SelectTrigger id="ageRange" className="mt-1"><SelectValue placeholder="Select range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="18-24">18-24</SelectItem>
                <SelectItem value="25-34">25-34</SelectItem>
                <SelectItem value="35-44">35-44</SelectItem>
                <SelectItem value="45-54">45-54</SelectItem>
                <SelectItem value="55+">55+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-3 block">Preferred Fit</Label>
            <RadioGroup value={form.preferredFit} onValueChange={(v) => setForm({ ...form, preferredFit: v as 'fitted' | 'regular' | 'relaxed' })} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2"><RadioGroupItem value="fitted" id="fitted" /><Label htmlFor="fitted">Fitted</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="regular" id="regular" /><Label htmlFor="regular">Regular</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="relaxed" id="relaxed" /><Label htmlFor="relaxed">Relaxed</Label></div>
            </RadioGroup>
          </div>
        </div>

        <Button type="submit" size="lg"><Save className="h-4 w-4" /> Save Measurements</Button>
      </form>
    </div>
  );
}
