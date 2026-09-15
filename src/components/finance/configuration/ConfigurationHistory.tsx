import type { FinanceConfigurationFromApi } from "@/lib/api-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  items: FinanceConfigurationFromApi[];
  selectedVersion: number | null;
  canActivate: boolean;
  canRestore: boolean;
  busy: boolean;
  onView: (item: FinanceConfigurationFromApi) => void;
  onActivate: (item: FinanceConfigurationFromApi) => void;
  onRestore: (item: FinanceConfigurationFromApi) => void;
};

export function ConfigurationHistory({
  items,
  selectedVersion,
  canActivate,
  canRestore,
  busy,
  onView,
  onActivate,
  onRestore,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
        <CardDescription>Toda alteração gera uma nova versão. Versões antigas não são apagadas.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Versão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Justificativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id || item.version} className={selectedVersion === item.version ? "bg-dcnet-surface-muted/70" : undefined}>
                <TableCell className="font-medium">v{item.version}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={item.active ? "success" : "default"}>{item.active ? "Ativa" : "Histórica"}</Badge>
                    <Badge variant="warning">Simulação</Badge>
                  </div>
                </TableCell>
                <TableCell>{item.updatedBy || item.createdBy || "—"}</TableCell>
                <TableCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell className="max-w-[20rem] truncate">{item.changeReason || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onView(item)} disabled={busy}>Visualizar</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onActivate(item)} disabled={busy || !canActivate}>Ativar</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onRestore(item)} disabled={busy || !canRestore}>Restaurar</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}