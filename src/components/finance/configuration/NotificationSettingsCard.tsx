import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["notifications"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["notifications"]) => void;
};

function parseIntList(raw: string): number[] {
  return [...new Set(raw.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item)))];
}

export function NotificationSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Avisos</CardTitle>
        <CardDescription>Canais e templates são configuráveis, mas não haverá envio automático no FIN-1.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary">
          <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Ativar avisos nesta versão simulada
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="notifications-before">Dias antes do vencimento</Label>
            <Input id="notifications-before" value={value.beforeDueDays.join(", ")} disabled={disabled} onChange={(e) => onChange({ ...value, beforeDueDays: parseIntList(e.target.value) })} placeholder="3, 1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notifications-after">Dias depois do vencimento</Label>
            <Input id="notifications-after" value={value.afterDueDays.join(", ")} disabled={disabled} onChange={(e) => onChange({ ...value, afterDueDays: parseIntList(e.target.value) })} placeholder="1, 3, 7" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary"><input type="checkbox" checked={value.channels.whatsapp} disabled={disabled} onChange={(e) => onChange({ ...value, channels: { ...value.channels, whatsapp: e.target.checked } })} />WhatsApp</label>
          <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary"><input type="checkbox" checked={value.channels.email} disabled={disabled} onChange={(e) => onChange({ ...value, channels: { ...value.channels, email: e.target.checked } })} />E-mail</label>
          <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary"><input type="checkbox" checked={value.channels.sms} disabled={disabled} onChange={(e) => onChange({ ...value, channels: { ...value.channels, sms: e.target.checked } })} />SMS</label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notifications-template">Template da mensagem</Label>
          <textarea id="notifications-template" rows={5} value={value.template} disabled={disabled} onChange={(e) => onChange({ ...value, template: e.target.value })} className="flex w-full rounded-xl border border-dcnet-border bg-white px-3 py-2 text-sm text-dcnet-text shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-dcnet-primary/40 disabled:cursor-not-allowed disabled:bg-dcnet-surface-muted" placeholder="Use esta área para preparar o texto padrão dos avisos." />
        </div>
      </CardContent>
    </Card>
  );
}