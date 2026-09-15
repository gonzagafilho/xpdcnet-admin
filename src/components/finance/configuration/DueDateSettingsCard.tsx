import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["due"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["due"]) => void;
};

export function DueDateSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vencimento</CardTitle>
        <CardDescription>Defina a régua base de vencimento e tolerância operacional.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="due-default-day">Dia padrão</Label>
          <Input id="due-default-day" type="number" min={1} max={31} value={value.defaultDueDay} disabled={disabled} onChange={(e) => onChange({ ...value, defaultDueDay: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due-grace-days">Tolerância (dias)</Label>
          <Input id="due-grace-days" type="number" min={0} max={120} value={value.graceDays} disabled={disabled} onChange={(e) => onChange({ ...value, graceDays: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due-hour">Horário de processamento</Label>
          <Input id="due-hour" type="number" min={0} max={23} value={value.processingHour} disabled={disabled} onChange={(e) => onChange({ ...value, processingHour: Number(e.target.value || 0) })} />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary">
          <input type="checkbox" checked={value.allowWeekendDue} disabled={disabled} onChange={(e) => onChange({ ...value, allowWeekendDue: e.target.checked })} />
          Permitir vencimento em fim de semana
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary">
          <input type="checkbox" checked={value.moveToNextBusinessDay} disabled={disabled} onChange={(e) => onChange({ ...value, moveToNextBusinessDay: e.target.checked })} />
          Mover para o próximo dia útil
        </label>
      </CardContent>
    </Card>
  );
}