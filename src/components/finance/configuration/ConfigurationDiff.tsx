import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  current: FinanceConfigurationFromApi | null;
  compareAgainst: FinanceConfigurationFromApi | null;
};

const sections: Array<{ key: keyof FinanceConfigurationFromApi; label: string }> = [
  { key: "due", label: "Vencimento" },
  { key: "penalties", label: "Multa e juros" },
  { key: "notifications", label: "Avisos" },
  { key: "suspension", label: "Suspensão" },
  { key: "reactivation", label: "Reativação" },
  { key: "scope", label: "Escopo" },
  { key: "exceptions", label: "Exceções" },
  { key: "installment", label: "Parcelamento" },
  { key: "security", label: "Segurança" },
];

export function ConfigurationDiff({ current, compareAgainst }: Props) {
  const changed = !current || !compareAgainst
    ? []
    : sections.filter((section) => JSON.stringify(current[section.key]) !== JSON.stringify(compareAgainst[section.key]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diff resumido</CardTitle>
        <CardDescription>Comparação de seções entre a configuração atual da tela e a versão selecionada no histórico.</CardDescription>
      </CardHeader>
      <CardContent>
        {!current || !compareAgainst ? (
          <p className="text-sm text-dcnet-muted">Selecione uma versão no histórico para visualizar as diferenças.</p>
        ) : changed.length === 0 ? (
          <p className="text-sm text-dcnet-muted">Sem diferenças estruturais relevantes entre as duas versões.</p>
        ) : (
          <ul className="space-y-2 text-sm text-dcnet-secondary">
            {changed.map((section) => (
              <li key={section.key} className="rounded-xl border border-dcnet-border bg-dcnet-surface-muted/50 px-3 py-2">
                {section.label}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}