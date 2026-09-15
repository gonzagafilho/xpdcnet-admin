import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["reactivation"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["reactivation"]) => void;
};

export function ReactivationSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reativação</CardTitle>
        <CardDescription>Preparação da política de retorno do serviço, ainda sem qualquer execução real.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-4">
          <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Ativar lógica de reativação em modo simulado
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-2">
          <input type="checkbox" checked={value.onPaymentConfirmation} disabled={disabled} onChange={(e) => onChange({ ...value, onPaymentConfirmation: e.target.checked })} />
          Após confirmação do pagamento
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-2">
          <input type="checkbox" checked={value.allowManualEmergency} disabled={disabled} onChange={(e) => onChange({ ...value, allowManualEmergency: e.target.checked })} />
          Permitir reativação manual de emergência
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="reactivation-delay">Atraso (minutos)</Label>
          <Input id="reactivation-delay" type="number" min={0} max={1440} value={value.delayMinutes} disabled={disabled} onChange={(e) => onChange({ ...value, delayMinutes: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reactivation-retries">Tentativas máximas</Label>
          <Input id="reactivation-retries" type="number" min={0} max={20} value={value.maximumRetries} disabled={disabled} onChange={(e) => onChange({ ...value, maximumRetries: Number(e.target.value || 0) })} />
        </div>
      </CardContent>
    </Card>
  );
}