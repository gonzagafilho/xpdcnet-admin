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
import { ArrowLeft, FileStack, Plus } from "lucide-react";

const LAYOUTS_API_DISPONIVEL = false;

export function ContratosLayoutsView() {
  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-2">
      <div className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Layouts de contratos</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              Modelos reutilizáveis para impressão ou PDF quando existir API (ex.{" "}
              <span className="font-mono text-xs">GET /contract-templates</span>). Sem endpoint, o painel mantém só a
              grelha vazia.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/contratos" className="gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar a contratos
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              disabled={!LAYOUTS_API_DISPONIVEL}
              title={LAYOUTS_API_DISPONIVEL ? undefined : "Aguarda API de layouts"}
            >
              <Plus className="h-4 w-4" />
              Novo layout
            </Button>
          </div>
        </div>
      </div>

      <div className="border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h3 className="text-sm font-bold text-neutral-900">Modelos</h3>
          <p className="text-xs text-neutral-500">0 layouts · sem integração</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">Nome</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">Formato</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wide text-neutral-600">Atualizado</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-wide text-neutral-600">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="py-14 text-center text-sm text-neutral-500">
                <FileStack className="mx-auto mb-3 h-10 w-10 text-neutral-300" aria-hidden />
                Nenhum layout cadastrado neste painel. Upload ou CRUD dependerão de rotas reais no backend.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
