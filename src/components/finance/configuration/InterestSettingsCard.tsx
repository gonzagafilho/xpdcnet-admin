import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["penalties"]["interest"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["penalties"]["interest"]) => void;
};

export function InterestSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Juros</CardTitle>
        <CardDescription>Régua financeira preparada apenas em modo simulado nesta etapa.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-4">
          <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Ativar juros nesta versão simulada
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="interest-monthly">Percentual mensal</Label>
          <Input id="interest-monthly" type="number" min={0} max={100} value={value.monthlyPercent} disabled={disabled} onChange={(e) => onChange({ ...value, monthlyPercent: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="interest-max">Teto</Label>
          <Input id="interest-max" type="number" min={0} max={100} value={value.maximumPercent} disabled={disabled} onChange={(e) => onChange({ ...value, maximumPercent: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="interest-days">Aplicar após (dias)</Label>
          <Input id="interest-days" type="number" min={0} max={120} value={value.applyAfterDays} disabled={disabled} onChange={(e) => onChange({ ...value, applyAfterDays: Number(e.target.value || 0) })} />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary">
          <input type="checkbox" checked={value.dailyProRata} disabled={disabled} onChange={(e) => onChange({ ...value, dailyProRata: e.target.checked })} />
          Cálculo diário proporcional
        </label>
      </CardContent>
    </Card>
  );
}