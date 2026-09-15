import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["installment"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["installment"]) => void;
};

export function InstallmentSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcelamento</CardTitle>
        <CardDescription>Parâmetros comerciais de parcelamento preparados para uma etapa posterior.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-4">
          <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Ativar política de parcelamento em simulação
        </label>
        <div className="space-y-1.5"><Label htmlFor="installment-entry">Entrada mínima (%)</Label><Input id="installment-entry" type="number" min={0} max={100} value={value.minimumEntryPercent} disabled={disabled} onChange={(e) => onChange({ ...value, minimumEntryPercent: Number(e.target.value || 0) })} /></div>
        <div className="space-y-1.5"><Label htmlFor="installment-max">Máximo de parcelas</Label><Input id="installment-max" type="number" min={1} max={36} value={value.maximumInstallments} disabled={disabled} onChange={(e) => onChange({ ...value, maximumInstallments: Number(e.target.value || 1) })} /></div>
        <div className="space-y-1.5"><Label htmlFor="installment-interest">Juros mensal (%)</Label><Input id="installment-interest" type="number" min={0} max={100} value={value.monthlyInterestPercent} disabled={disabled} onChange={(e) => onChange({ ...value, monthlyInterestPercent: Number(e.target.value || 0) })} /></div>
        <div className="space-y-1.5"><Label htmlFor="installment-discount">Desconto máximo (%)</Label><Input id="installment-discount" type="number" min={0} max={100} value={value.maximumDiscountPercent} disabled={disabled} onChange={(e) => onChange({ ...value, maximumDiscountPercent: Number(e.target.value || 0) })} /></div>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-4"><input type="checkbox" checked={value.requireApproval} disabled={disabled} onChange={(e) => onChange({ ...value, requireApproval: e.target.checked })} />Exigir aprovação para parcelamento</label>
      </CardContent>
    </Card>
  );
}