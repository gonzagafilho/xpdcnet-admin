"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiRequestError, apiFetch, getSessionToken } from "@/lib/api-client";

type Target = {
  id: string;
  name: string;
  host: string;
  port: number;
  executionMode: string;
  node: { id: string; name: string; code: string } | null;
  pop: string;
};

type ImportError = { row: number | null; field: string; code: string; message: string };
type PreviewAccess = {
  rowNumber: number;
  username: string;
  planName: string;
  matchedPppoe: boolean;
  hasPassword: boolean;
  errors: ImportError[];
};
type PreviewRow = {
  rowNumber: number;
  fullName: string;
  document: string;
  status: "valid" | "duplicate" | "invalid";
  accessCount: number;
  accesses: PreviewAccess[];
  errors: ImportError[];
};

type ImportJob = {
  id: string;
  source: string;
  originalFilename: string;
  status: "preview" | "completed" | "failed";
  target: { serverId: string | null; serverName: string; networkNodeName: string };
  detectedColumns: string[];
  columnMapping: Record<string, string>;
  previewRows: PreviewRow[];
  report: {
    totalRows: number;
    totalAccessRows: number;
    multiAccessCustomers: number;
    criticalDuplicateRows: number;
    validRows: number;
    duplicateRows: number;
    invalidRows: number;
    matchedPppoeRows: number;
    unmatchedPppoeRows: number;
    importedRows: number;
    importedAccessRows: number;
    skippedRows: number;
    errors: ImportError[];
  };
  createdAt: string | null;
  completedAt: string | null;
};

const TARGET_FIELDS = [
  ["", "Ignorar coluna"],
  ["fullName", "Nome"],
  ["document", "CPF/CNPJ"],
  ["whatsapp", "WhatsApp"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["zip", "CEP"],
  ["street", "Endereço"],
  ["number", "Número"],
  ["neighborhood", "Bairro"],
  ["city", "Cidade"],
  ["state", "UF"],
  ["plan", "Plano"],
  ["contract", "Contrato"],
  ["pppoeUsername", "Login PPPoE"],
  ["pppoePassword", "Senha PPPoE"],
  ["concentrator", "Concentrador"],
] as const;

function userError(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function formatDate(value: string | null) {
  if (!value) return "Em andamento";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sem data"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

function statusBadge(status: PreviewRow["status"]) {
  if (status === "valid") return <Badge variant="success">Válido</Badge>;
  if (status === "duplicate") return <Badge variant="warning">Duplicado</Badge>;
  return <Badge variant="error">Inválido</Badge>;
}

function ImportarClientesContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [targets, setTargets] = useState<Target[]>([]);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [targetId, setTargetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState("");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === targetId) || null,
    [targetId, targets],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [targetResponse, jobsResponse] = await Promise.all([
        apiFetch<{ items: Target[] }>("/admin/data-import/targets"),
        apiFetch<{ items: ImportJob[] }>("/admin/data-import/jobs?limit=30"),
      ]);
      const nextTargets = targetResponse.items || [];
      setTargets(nextTargets);
      setTargetId((current) => current || nextTargets[0]?.id || "");
      setHistory(jobsResponse.items || []);
    } catch (err) {
      setError(userError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function chooseFile(next: File | null) {
    setFile(next);
    setJob(null);
    setMapping({});
    setNotice("");
    setError("");
    setFileBase64(next ? await fileToBase64(next) : "");
  }

  async function preview(revalidate = false) {
    if (!file || !fileBase64) return setError("Selecione um arquivo CSV.");
    if (!targetId) return setError("Selecione o concentrador destino.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch<ImportJob>("/admin/data-import/customers/preview", {
        method: "POST",
        body: JSON.stringify({
          originalFilename: file.name,
          contentBase64: fileBase64,
          targetServerId: targetId,
          jobId: revalidate ? job?.id : undefined,
          columnMapping: revalidate ? mapping : undefined,
        }),
        timeoutMs: 60_000,
        retry: false,
      });
      setJob(result);
      setMapping(result.columnMapping || {});
      setNotice("Pré-visualização concluída. Nenhum cliente foi gravado.");
      await load();
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!job || job.status !== "preview" || job.report.validRows < 1) return;
    if (!window.confirm(`Importar ${job.report.validRows} clientes válidos como pendentes?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<ImportJob>(`/admin/data-import/customers/${encodeURIComponent(job.id)}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
        timeoutMs: 120_000,
        retry: false,
      });
      setJob(result);
      setNotice(`${result.report.importedRows} clientes importados. Nenhuma sincronização RouterOS foi executada.`);
      await load();
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    setError("");
    try {
      const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
      if (!base) throw new Error("NEXT_PUBLIC_API_URL não configurada.");
      const headers = new Headers();
      const token = getSessionToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${base}/admin/data-import/template.csv`, { headers });
      if (!response.ok) throw new Error("Não foi possível baixar o modelo CSV.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "xpdcnet-modelo-clientes.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(userError(err));
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <section className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700">Migração de dados</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Importar clientes</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Fluxo seguro e independente da plataforma de origem. A gravação só é liberada após preview e validação.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading} title="Atualizar dados">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => void downloadTemplate()}>
              <Download className="h-4 w-4" /> Baixar modelo CSV
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-4">
        {["Upload", "Pré-visualização", "Validação", "Confirmação"].map((label, index) => (
          <div key={label} className="flex min-h-14 items-center gap-3 border-b-2 border-emerald-600 bg-white px-3 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">{index + 1}</span>
            <span className="text-sm font-medium text-slate-800">{label}</span>
            {index < 3 ? <ArrowRight className="ml-auto hidden h-4 w-4 text-slate-300 sm:block" /> : null}
          </div>
        ))}
      </div>

      {error ? <div className="border-l-4 border-rose-500 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      {notice ? <div className="border-l-4 border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}

      {requestedTab === "historico" ? (
        <HistoryPanel rows={history} loading={loading} />
      ) : requestedTab === "modelo" ? (
        <Card>
          <CardHeader><CardTitle>Modelo oficial XPDCNET</CardTitle><CardDescription>CSV UTF-8 com as colunas aceitas pela primeira versão.</CardDescription></CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <code className="w-full overflow-x-auto border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">nome,cpf_cnpj,whatsapp,telefone,email,cep,endereco,numero,bairro,cidade,uf,plano,contrato,login_pppoe,senha_pppoe,concentrador</code>
            <Button onClick={() => void downloadTemplate()}><Download className="h-4 w-4" /> Baixar modelo CSV</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader><CardTitle>Arquivo de origem</CardTitle><CardDescription>CSV até 8 MB e 5.000 linhas. XLSX está preparado para habilitação posterior.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="import-file">Planilha</Label>
                    <Input id="import-file" type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(event) => void chooseFile(event.target.files?.[0] || null)} />
                    <p className="text-xs text-slate-500">{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "Nenhum arquivo selecionado"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target">Concentrador destino</Label>
                    <Select id="target" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                      <option value="">Selecione</option>
                      {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                    </Select>
                    {selectedTarget ? <p className="text-xs text-slate-500">Node: {selectedTarget.node?.name || "Sem node"} · POP: {selectedTarget.pop}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void preview(false)} disabled={busy || !file || !targetId}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Gerar pré-visualização
                  </Button>
                  {job ? <Button variant="outline" onClick={() => void preview(true)} disabled={busy}><RefreshCw className="h-4 w-4" /> Revalidar mapeamento</Button> : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /> Proteções ativas</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>Clientes existentes nunca são sobrescritos.</p>
                <p>CPF/CNPJ e login PPPoE são revalidados na confirmação.</p>
                <p>Novos clientes entram como pendentes.</p>
                <p>Nenhuma ação RouterOS é executada.</p>
              </CardContent>
            </Card>
          </div>

          {job ? (
            <>
              <Card>
                <CardHeader><CardTitle>Mapeamento de colunas</CardTitle><CardDescription>Revise como cada coluna será interpretada pelo XPDCNET.</CardDescription></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {job.detectedColumns.map((column) => (
                    <div key={column} className="space-y-1.5">
                      <Label>{column}</Label>
                      <Select value={mapping[column] || ""} onChange={(event) => setMapping((current) => ({ ...current, [column]: event.target.value }))}>
                        {TARGET_FIELDS.map(([value, label]) => <option key={value || "ignore"} value={value}>{label}</option>)}
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Summary report={job.report} />

              <Card>
                <CardHeader><CardTitle>Pré-visualização</CardTitle><CardDescription>Até 50 registros. Senhas PPPoE nunca são exibidas.</CardDescription></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Cliente</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Plano</TableHead><TableHead>PPPoE</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {job.previewRows.map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell><p className="font-medium">{row.fullName || "Sem nome"}</p><p className="text-xs text-slate-500">{row.accessCount} acesso(s) PPPoE</p></TableCell>
                          <TableCell className="font-mono text-xs">{row.document || "—"}</TableCell>
                          <TableCell>{row.accesses.map((access) => <p key={`${row.rowNumber}-${access.username}`} className="text-xs">{access.planName || "—"}</p>)}</TableCell>
                          <TableCell>{row.accesses.map((access) => <div key={access.username} className="mb-1 last:mb-0"><p className="font-mono text-xs">{access.username || "—"}</p><p className="text-xs text-slate-500">{access.matchedPppoe ? "Encontrado em snapshot" : "Sem correspondência persistida"}</p></div>)}</TableCell>
                          <TableCell>{statusBadge(row.status)}{row.errors[0] ? <p className="mt-1 max-w-52 text-xs text-rose-700">{row.errors[0].message}</p> : null}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">Somente os {job.report.validRows} registros válidos serão importados.</p>
                <Button onClick={() => void confirmImport()} disabled={busy || job.status !== "preview" || job.report.validRows < 1}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmar importação
                </Button>
              </div>
            </>
          ) : null}

          <HistoryPanel rows={history} loading={loading} />
        </>
      )}
    </div>
  );
}

export default function ImportarClientesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando Central de Migração...</div>}>
      <ImportarClientesContent />
    </Suspense>
  );
}

function Summary({ report }: { report: ImportJob["report"] }) {
  const items = [
    ["Clientes únicos", report.totalRows, Users, "text-slate-700"],
    ["Acessos PPPoE", report.totalAccessRows, FileSpreadsheet, "text-sky-700"],
    ["Multiacesso", report.multiAccessCustomers, ShieldCheck, "text-violet-700"],
    ["Válidos", report.validRows, CheckCircle2, "text-emerald-700"],
    ["Duplicidades críticas", report.criticalDuplicateRows, AlertTriangle, "text-amber-700"],
    ["Inválidos", report.invalidRows, AlertTriangle, "text-rose-700"],
  ] as const;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{items.map(([label, value, Icon, color]) => <Card key={label}><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${color}`} /><div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div></CardContent></Card>)}</div>;
}

function HistoryPanel({ rows, loading }: { rows: ImportJob[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Histórico de importações</CardTitle><CardDescription>Previews e confirmações registradas por tenant.</CardDescription></CardHeader>
      <CardContent>
        {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...</p> : rows.length === 0 ? <p className="text-sm text-slate-500">Nenhuma importação registrada.</p> : (
          <Table><TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Destino</TableHead><TableHead>Status</TableHead><TableHead>Registros</TableHead><TableHead>Data</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><p className="font-medium">{row.originalFilename}</p><p className="text-xs uppercase text-slate-500">{row.source}</p></TableCell><TableCell>{row.target.serverName}<p className="text-xs text-slate-500">{row.target.networkNodeName || "Sem node"}</p></TableCell><TableCell>{row.status === "completed" ? <Badge variant="success">Concluído</Badge> : row.status === "failed" ? <Badge variant="error">Falhou</Badge> : <Badge variant="warning">Preview</Badge>}</TableCell><TableCell>{row.status === "completed" ? `${row.report.importedRows} clientes / ${row.report.importedAccessRows} acessos` : `${row.report.validRows} válidos`}</TableCell><TableCell className="text-xs"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatDate(row.completedAt || row.createdAt)}</TableCell></TableRow>)}</TableBody></Table>
        )}
      </CardContent>
    </Card>
  );
}
