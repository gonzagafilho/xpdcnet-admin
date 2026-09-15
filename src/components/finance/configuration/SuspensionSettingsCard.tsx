import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi["suspension"];
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi["suspension"]) => void;
};

export function SuspensionSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suspensão</CardTitle>
        <CardDescription>Os campos abaixo servem apenas para planejamento. Nenhuma ação real será executada no FIN-1.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-4">
          <input type="checkbox" checked={value.enabled} disabled={disabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Ativar lógica de suspensão apenas na configuração simulada
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="suspension-days">Dias após vencimento</Label>
          <Input id="suspension-days" type="number" min={0} max={120} value={value.daysAfterDue} disabled={disabled} onChange={(e) => onChange({ ...value, daysAfterDue: Number(e.target.value || 0) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suspension-hour">Horário</Label>
          <Input id="suspension-hour" type="number" min={0} max={23} value={value.processingHour} disabled={disabled} onChange={(e) => onChange({ ...value, processingHour: Number(e.target.value || 0) })} />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary md:col-span-2 xl:col-span-2">
          <input type="checkbox" checked={value.markOnlyDelinquent} disabled={disabled} onChange={(e) => onChange({ ...value, markOnlyDelinquent: e.target.checked })} />
          Somente marcar inadimplente
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-950"><input type="checkbox" checked={value.suspendPppoe} disabled={disabled} onChange={(e) => onChange({ ...value, suspendPppoe: e.target.checked })} />PPPoE</label>
        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-950"><input type="checkbox" checked={value.suspendMikrotik} disabled={disabled} onChange={(e) => onChange({ ...value, suspendMikrotik: e.target.checked })} />MikroTik</label>
        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-950"><input type="checkbox" checked={value.suspendOlt} disabled={disabled} onChange={(e) => onChange({ ...value, suspendOlt: e.target.checked })} />OLT</label>
        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-950"><input type="checkbox" checked={value.suspendBeesweb} disabled={disabled} onChange={(e) => onChange({ ...value, suspendBeesweb: e.target.checked })} />BeesWeb</label>
      </CardContent>
    </Card>
  );
}