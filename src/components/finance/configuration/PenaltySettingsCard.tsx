import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["penalties"]["lateFee"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["penalties"]["lateFee"]) => void;
};

export function PenaltySettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Multa</CardTitle>
        <CardDescription>Configuração preparatória. O FIN-1 não executa cobrança automática real.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-4">
          <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Ativar multa nesta versão simulada
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="late-fee-percent">Percentual</Label>
          <Input id="late-fee-percent" type="number" min={0} max={100} value={value.percent} disabled={disabled} onChange={(e) => onChange({ ...value, percent: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="late-fee-min">Valor mínimo</Label>
          <Input id="late-fee-min" type="number" min={0} value={value.minimumAmount} disabled={disabled} onChange={(e) => onChange({ ...value, minimumAmount: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="late-fee-max">Valor máximo</Label>
          <Input id="late-fee-max" type="number" min={0} value={value.maximumAmount} disabled={disabled} onChange={(e) => onChange({ ...value, maximumAmount: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="late-fee-days">Aplicar após (dias)</Label>
          <Input id="late-fee-days" type="number" min={0} max={120} value={value.applyAfterDays} disabled={disabled} onChange={(e) => onChange({ ...value, applyAfterDays: Number(e.target.value || 0) })} />
        </div>
      </CardContent>
    </Card>
  );
}