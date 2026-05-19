"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, FileText, Plus } from "lucide-react";

/** Sem rota de contratos no contrato atual da API XPDCNET — apenas UI preparada. */
const CONTRATOS_API_DISPONIVEL = false;

export function ContratosView() {
  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-2">
      <div className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Contratos com clientes</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              Listagem e gestão de contratos quando existir endpoint dedicado (ex.{" "}
              <span className="font-mono text-xs">GET /contracts</span>). Nesta versão não há chamada à API —
              a área serve só de estrutura visual.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/contratos/layouts" className="gap-1">
                Layouts de contratos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              disabled={!CONTRATOS_API_DISPONIVEL}
              title={CONTRATOS_API_DISPONIVEL ? undefined : "Aguarda API de contratos"}
            >
              <Plus className="h-4 w-4" />
              Novo contrato
            </Button>
          </div>
        </div>

        <p className="pt-3 text-xs text-neutral-500">
          Dados de vínculo formal podem evoluir a partir do cadastro de clientes; até lá, não exibimos linhas
          inventadas.
        </p>
      </div>

      <div className="border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Registos</h3>
            <p className="text-xs text-neutral-500">0 contratos nesta consulta · sem fonte de dados ligada</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                Cliente / referência
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">Plano</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">Início</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">Estado</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-wide text-neutral-600">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="py-14 text-center text-sm text-neutral-500">
                <FileText className="mx-auto mb-3 h-10 w-10 text-neutral-300" aria-hidden />
                Nenhum contrato listado. Quando o backend expuser listagem, as colunas acima recebem dados reais.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
