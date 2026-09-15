import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["security"];
  simulationMode: boolean;
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["security"]) => void;
};

export function SecuritySettingsCard({ value, simulationMode, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Segurança</CardTitle>
        <CardDescription>Travas operacionais do FIN-1. O modo real permanece bloqueado no backend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/60 p-4">
          <Badge variant="warning">simulationMode = {simulationMode ? "true" : "false"}</Badge>
          <Badge variant={value.emergencyStop ? "error" : "default"}>{value.emergencyStop ? "Parada de emergência armada" : "Sem parada de emergência"}</Badge>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary">
          <input type="checkbox" checked={value.requireConfirmation} disabled={disabled} onChange={(e) => onChange({ ...value, requireConfirmation: e.target.checked })} />
          Exigir confirmação antes de ativar ou restaurar versão
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="security-run-limit">Máximo de ações por execução</Label>
            <Input id="security-run-limit" type="number" min={0} max={1000} value={value.maximumActionsPerRun} disabled={disabled} onChange={(e) => onChange({ ...value, maximumActionsPerRun: Number(e.target.value || 0) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="security-day-limit">Máximo de ações por dia</Label>
            <Input id="security-day-limit" type="number" min={0} max={10000} value={value.maximumActionsPerDay} disabled={disabled} onChange={(e) => onChange({ ...value, maximumActionsPerDay: Number(e.target.value || 0) })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}