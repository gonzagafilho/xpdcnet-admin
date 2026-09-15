import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  scope: FinanceConfigurationFromApi["scope"];
  exceptions: FinanceConfigurationFromApi["exceptions"];
  disabled: boolean;
  onScopeChange: (next: FinanceConfigurationFromApi["scope"]) => void;
  onExceptionsChange: (next: FinanceConfigurationFromApi["exceptions"]) => void;
};

function parseTextList(raw: string): string[] {
  return [...new Set(raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
}

export function ExceptionsSettingsCard({
  scope,
  exceptions,
  disabled,
  onScopeChange,
  onExceptionsChange,
}: Props) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Escopo</CardTitle>
          <CardDescription>Defina onde esta configuração será considerada quando a automação for liberada futuramente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 rounded-xl border border-dcnet-border p-3 text-sm text-dcnet-secondary">
            <input type="checkbox" checked={scope.global} disabled={disabled} onChange={(e) => onScopeChange({ ...scope, global: e.target.checked })} />
            Aplicar regra global
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="scope-plans">Planos</Label>
            <Input id="scope-plans" value={scope.plans.join(", ")} disabled={disabled} onChange={(e) => onScopeChange({ ...scope, plans: parseTextList(e.target.value) })} placeholder="IDs ou slugs de planos" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scope-clients">Clientes</Label>
            <Input id="scope-clients" value={scope.clients.join(", ")} disabled={disabled} onChange={(e) => onScopeChange({ ...scope, clients: parseTextList(e.target.value) })} placeholder="IDs de clientes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scope-groups">Grupos</Label>
            <Input id="scope-groups" value={scope.groups.join(", ")} disabled={disabled} onChange={(e) => onScopeChange({ ...scope, groups: parseTextList(e.target.value) })} placeholder="Nomes de grupos" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exceções</CardTitle>
          <CardDescription>Proteções adicionais para clientes, planos ou grupos que não devem entrar no fluxo automático.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exception-clients">Clientes protegidos</Label>
            <Input id="exception-clients" value={exceptions.protectedClients.join(", ")} disabled={disabled} onChange={(e) => onExceptionsChange({ ...exceptions, protectedClients: parseTextList(e.target.value) })} placeholder="IDs de clientes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exception-plans">Planos protegidos</Label>
            <Input id="exception-plans" value={exceptions.protectedPlans.join(", ")} disabled={disabled} onChange={(e) => onExceptionsChange({ ...exceptions, protectedPlans: parseTextList(e.target.value) })} placeholder="IDs ou slugs de planos" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exception-groups">Grupos protegidos</Label>
            <Input id="exception-groups" value={exceptions.protectedGroups.join(", ")} disabled={disabled} onChange={(e) => onExceptionsChange({ ...exceptions, protectedGroups: parseTextList(e.target.value) })} placeholder="Nomes de grupos" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}