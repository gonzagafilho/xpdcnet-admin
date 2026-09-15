import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: FinanceConfigurationFromApi;
  disabled: boolean;
  onChange: (next: FinanceConfigurationFromApi) => void;
};

export function GeneralSettingsCard({ value, disabled, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geral</CardTitle>
        <CardDescription>Contexto global, versão atual e justificativa obrigatória para salvar ou ativar.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fin-timezone">Timezone</Label>
          <Input
            id="fin-timezone"
            value={value.timezone}
            onChange={(e) => onChange({ ...value, timezone: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fin-currency">Moeda</Label>
          <Input
            id="fin-currency"
            value={value.currency}
            onChange={(e) => onChange({ ...value, currency: e.target.value.toUpperCase() })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2 rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dcnet-muted">Versão e status</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={value.active ? "success" : "default"}>{value.active ? "Ativa" : "Rascunho"}</Badge>
            <Badge variant="warning">Simulação obrigatória</Badge>
            {value.restoredFromVersion ? <Badge variant="outline">Restaurada da v{value.restoredFromVersion}</Badge> : null}
          </div>
          <p className="text-sm text-dcnet-secondary">Versão {value.version || 0}</p>
          <p className="text-xs text-dcnet-muted">Hash: {value.contentHash.slice(0, 16)}...</p>
        </div>
        <div className="space-y-2 rounded-2xl border border-dcnet-border bg-dcnet-surface-muted/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dcnet-muted">Metadados</p>
          <p className="text-sm text-dcnet-secondary">Criado por: {value.createdBy || "—"}</p>
          <p className="text-sm text-dcnet-secondary">Atualizado por: {value.updatedBy || "—"}</p>
          <p className="text-xs text-dcnet-muted">Ativado em: {value.activatedAt ? new Date(value.activatedAt).toLocaleString("pt-BR") : "—"}</p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="fin-change-reason">Justificativa</Label>
          <textarea
            id="fin-change-reason"
            rows={4}
            value={value.changeReason}
            onChange={(e) => onChange({ ...value, changeReason: e.target.value })}
            disabled={disabled}
            className="flex w-full rounded-xl border border-dcnet-border bg-white px-3 py-2 text-sm text-dcnet-text shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-dcnet-primary/40 disabled:cursor-not-allowed disabled:bg-dcnet-surface-muted"
            placeholder="Descreva por que esta configuração está sendo criada, ativada ou restaurada."
          />
        </div>
      </CardContent>
    </Card>
  );
}