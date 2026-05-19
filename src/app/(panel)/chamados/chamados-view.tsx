"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Filter, Headphones, Plus, Search } from "lucide-react";

/** Sem endpoint de chamados no backend XPDCNET atual — UI preparada para integração futura. */
const CHAMADOS_API_DISPONIVEL = false;

const PAGE_SIZE = 10;

type ToastState = { variant: "success" | "error"; message: string } | null;

type ChamadoRow = {
  id: string;
  protocolo: string;
  assunto: string;
  solicitante: string;
  estado: string;
  abertura: string;
};

export function ChamadosView() {
  const searchParams = useSearchParams();
  const visaoMinha = searchParams.get("visao") === "minha";

  const [rows] = useState<ChamadoRow[]>([]);
  /** Reservado para quando existir fetch à API de chamados. */
  const loading = false;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [novoAssunto, setNovoAssunto] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaPrioridade, setNovaPrioridade] = useState("media");
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, prioridadeFiltro, visaoMinha]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredRows = useMemo(() => {
    let r = rows;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.protocolo.toLowerCase().includes(q) ||
          x.assunto.toLowerCase().includes(q) ||
          x.solicitante.toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const openNovoChamado = useCallback(() => {
    setNovoAssunto("");
    setNovaDescricao("");
    setNovaPrioridade("media");
    setModalOpen(true);
  }, []);

  const submitNovoChamado = useCallback(() => {
    if (!CHAMADOS_API_DISPONIVEL) {
      setToast({
        variant: "error",
        message:
          "Nenhum dado foi enviado: o backend XPDCNET ainda não expõe API de chamados. Estrutura preparada para evolução.",
      });
      setModalOpen(false);
      return;
    }
  }, []);

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredRows.length);

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5">
      {toast ? (
        <div
          className={
            toast.variant === "success"
              ? "fixed bottom-4 right-4 z-[100] max-w-md rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg"
              : "fixed bottom-4 right-4 z-[100] max-w-md rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg"
          }
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <div className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Chamados</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              Central de atendimento operacional.{" "}
              {!CHAMADOS_API_DISPONIVEL ? (
                <span className="font-medium text-amber-800">
                  API de chamados ainda não ligada — indicadores e lista aguardam o backend.
                </span>
              ) : (
                <span>Dados em tempo real da API.</span>
              )}
            </p>
            {visaoMinha ? (
              <p className="mt-2 text-xs font-medium text-neutral-500">
                Visão do menu: <span className="text-neutral-800">Meus chamados</span> (filtro aplicável quando a API
                existir).
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2 border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            onClick={openNovoChamado}
          >
            <Plus className="h-4 w-4" />
            Novo chamado
          </Button>
        </div>

        {/* Cards de status (valores honestos até existir API) */}
        <div className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-sm border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-sky-900/90">Abertos</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">—</p>
            <p className="text-xs text-sky-900/75">Contagem: após integração</p>
          </div>
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-amber-900/90">Em atendimento</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">—</p>
            <p className="text-xs text-amber-900/75">Contagem: após integração</p>
          </div>
          <div className="rounded-sm border border-violet-200 bg-violet-50 px-4 py-3 text-violet-950">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-violet-900/90">Aguardando cliente</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">—</p>
            <p className="text-xs text-violet-900/80">Contagem: após integração</p>
          </div>
          <div className="rounded-sm border border-neutral-200 bg-neutral-100 px-4 py-3 text-neutral-900">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-neutral-600">Encerrados (30d)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">—</p>
            <p className="text-xs text-neutral-600">Contagem: após integração</p>
          </div>
        </div>

        <div className="grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="space-y-1.5 lg:col-span-5">
            <Label htmlFor="cham-search" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Pesquisar
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="cham-search"
                placeholder="Protocolo, assunto ou solicitante…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
                className="border-neutral-200 bg-neutral-50 pl-9"
              />
            </div>
          </div>
          <div className="lg:col-span-7 lg:flex lg:items-end lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-neutral-200 sm:w-auto"
              onClick={() => setFiltersModalOpen(true)}
            >
              <Filter className="h-4 w-4" aria-hidden />
              Mais filtros
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="border border-neutral-200 bg-white px-4 py-16 text-center">
          <p className="text-sm font-medium text-neutral-600">A carregar chamados…</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="border border-neutral-200 bg-white px-4 py-10">
          <EmptyState
            icon={<Headphones className="mx-auto h-10 w-10 text-neutral-400" />}
            title="Nenhum chamado listado"
            description={
              CHAMADOS_API_DISPONIVEL
                ? debouncedSearch || visaoMinha
                  ? "Nenhum resultado para os filtros atuais."
                  : "Não há registos."
                : "O backend ainda não fornece listagem de chamados. Quando o endpoint existir, os dados aparecerão aqui sem alterar o layout."
            }
            action={
              <Button
                type="button"
                className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                onClick={openNovoChamado}
              >
                Novo chamado
              </Button>
            }
          />
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h3 className="text-sm font-bold text-neutral-900">Registos</h3>
            <p className="text-xs text-neutral-500">
              {filteredRows.length} chamado(s) · página {page} de {totalPages}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.protocolo}</TableCell>
                  <TableCell className="font-medium">{r.assunto}</TableCell>
                  <TableCell>{r.solicitante}</TableCell>
                  <TableCell>{r.estado}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-zinc-600">{r.abertura}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="outline" size="sm" disabled>
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-xs text-neutral-600">
              <span>
                {rangeStart}–{rangeEnd} de {filteredRows.length}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Seguinte
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={filtersModalOpen}
        onOpenChange={setFiltersModalOpen}
        title="Filtros avançados"
        description="Critérios adicionais para a lista de chamados. Campos desativados até existir API de filtragem."
        className="max-w-lg"
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="cham-f-prio" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Prioridade
            </Label>
            <Select
              id="cham-f-prio"
              value={prioridadeFiltro}
              onChange={(e) => setPrioridadeFiltro(e.target.value)}
              disabled
              className="border-neutral-200 bg-neutral-50 opacity-70"
            >
              <option value="">Todas (em breve)</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
            <p className="text-xs text-neutral-500">Depende da API de chamados.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Período</Label>
            <Input type="date" disabled className="border-neutral-200 bg-neutral-50 opacity-70" />
            <p className="text-xs text-neutral-500">Em breve.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Categoria</Label>
            <Select disabled className="border-neutral-200 bg-neutral-50 opacity-70">
              <option>Todas (em breve)</option>
            </Select>
          </div>
          <div className="flex justify-end border-t border-neutral-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setFiltersModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Novo chamado"
        description="Formulário operacional. O registo só será persistido quando existir endpoint no backend."
        className="max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-sm border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            Integração pendente: nenhuma chamada HTTP será feita ao guardar até a API estar definida.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-assunto">Assunto *</Label>
            <Input
              id="nc-assunto"
              value={novoAssunto}
              onChange={(e) => setNovoAssunto(e.target.value)}
              placeholder="Resumo do pedido"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-desc">Descrição *</Label>
            <textarea
              id="nc-desc"
              rows={4}
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              placeholder="Detalhe o problema ou pedido"
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-prio">Prioridade</Label>
            <Select
              id="nc-prio"
              value={novaPrioridade}
              onChange={(e) => setNovaPrioridade(e.target.value)}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={() => void submitNovoChamado()}
            >
              Registar chamado
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
