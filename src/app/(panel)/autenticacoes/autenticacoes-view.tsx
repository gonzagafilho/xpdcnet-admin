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
import { ArrowRight, KeyRound } from "lucide-react";

export function AutenticacoesView() {
  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 rounded-2xl bg-slate-50 p-5 pb-6 sm:p-6 lg:p-8">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Acessos de clientes</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                Gestão de usuário e senha de acesso à internet
              </p>
            </div>
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900">Gestão de acessos</h3>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                Acompanhe as informações de acesso dos clientes de forma simples e organizada. Os dados principais
                continuam vinculados ao cadastro do cliente, mantendo tudo centralizado e fácil de atualizar.
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                Esta área é destinada apenas ao acesso dos clientes. O login do painel administrativo continua separado
                e protegido.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" asChild className="shrink-0 border-slate-200">
            <Link href="/clientes" className="gap-1">
              Ver clientes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm shadow-sm sm:px-6 sm:py-5">
        <p className="font-medium leading-snug text-blue-800">Em breve, esta área terá listagem completa dos acessos.</p>
        <p className="mt-2 leading-relaxed text-blue-900/85">
          Enquanto isso, as informações continuam sendo geridas diretamente no cadastro dos clientes.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-slate-900">Acessos cadastrados</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Consulte os dados de acesso dos clientes assim que a listagem estiver disponível nesta área.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-600">Cliente</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-600">Utilizador</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-600">Estado</TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-slate-600">Última revisão</TableHead>
              <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell colSpan={5} className="px-5 py-16 text-center sm:px-6">
                <KeyRound className="mx-auto mb-4 h-9 w-9 text-slate-300" aria-hidden strokeWidth={1.25} />
                <p className="text-sm font-medium text-slate-700">Nenhum acesso disponível para visualização no momento.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                  Quando a listagem estiver habilitada, os acessos dos clientes aparecerão aqui de forma automática.
                </p>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
