"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type ClienteAuthDraft = {
  accessUsername: string;
  accessPassword: string;
  authType: string;
  server: string;
  mikrotikProfile: string;
  mikrotikComment: string;
  mikrotikLinked: boolean;
  ip: string;
  mac: string;
  tags: string;
  authOperationalLabel: string;
};

type ClienteAutenticacaoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  planLabel: string;
  contractHint: string;
  /** Se true, senha pode ficar vazia (mantém a já definida no estado / API). */
  passwordOptional: boolean;
  value: ClienteAuthDraft;
  onSave: (next: ClienteAuthDraft) => void;
};

export function ClienteAutenticacaoModal({
  open,
  onOpenChange,
  clientName,
  planLabel,
  contractHint,
  passwordOptional,
  value,
  onSave,
}: ClienteAutenticacaoModalProps) {
  const [local, setLocal] = useState<ClienteAuthDraft>(value);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocal({ ...value });
      setErr(null);
    }
  }, [open, value]);

  const handleSave = () => {
    setErr(null);
    if (!local.accessUsername.trim()) {
      setErr("Login é obrigatório.");
      return;
    }
    if (!passwordOptional && !local.accessPassword.trim()) {
      setErr("Senha é obrigatória.");
      return;
    }
    onSave(local);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Dados de acesso do cliente"
      description="Organize as credenciais e informações necessárias para liberar e identificar o acesso do cliente."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {err ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Nome cliente</Label>
          <Input readOnly value={clientName} className="border-neutral-200 bg-neutral-50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Contrato (referência)</Label>
          <Input readOnly value={contractHint} className="border-neutral-200 bg-neutral-50 text-sm" />
          <p className="text-[0.65rem] text-neutral-500">Resumo das condições comerciais atuais.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Planos</Label>
          <Input readOnly value={planLabel} className="border-neutral-200 bg-neutral-50 text-sm" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ca-user" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Login *
          </Label>
          <Input
            id="ca-user"
            value={local.accessUsername}
            onChange={(e) => setLocal((x) => ({ ...x, accessUsername: e.target.value }))}
            className="border-neutral-200 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-pass" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Senha {passwordOptional ? "(vazio = manter)" : "*"}
          </Label>
          <Input
            id="ca-pass"
            type="password"
            autoComplete="new-password"
            value={local.accessPassword}
            onChange={(e) => setLocal((x) => ({ ...x, accessPassword: e.target.value }))}
            className="border-neutral-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-srv" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Servidor
          </Label>
          <Input
            id="ca-srv"
            value={local.server}
            onChange={(e) => setLocal((x) => ({ ...x, server: e.target.value }))}
            className="border-neutral-200"
            placeholder="Equipamento ou ponto de acesso"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ca-mt" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Perfil de velocidade
            </Label>
            <Input
              id="ca-mt"
              value={local.mikrotikProfile}
              onChange={(e) => setLocal((x) => ({ ...x, mikrotikProfile: e.target.value }))}
              className="border-neutral-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-authtype" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tipo de autenticação
            </Label>
            <Select
              id="ca-authtype"
              value={local.authType}
              onChange={(e) => setLocal((x) => ({ ...x, authType: e.target.value }))}
              className="border-neutral-200"
            >
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-mtcomm" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Observação de rede
          </Label>
          <textarea
            id="ca-mtcomm"
            rows={2}
            value={local.mikrotikComment}
            onChange={(e) => setLocal((x) => ({ ...x, mikrotikComment: e.target.value }))}
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ca-ip" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              IP
            </Label>
            <Input
              id="ca-ip"
              value={local.ip}
              onChange={(e) => setLocal((x) => ({ ...x, ip: e.target.value }))}
              className="border-neutral-200 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-mac" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              MAC
            </Label>
            <Input
              id="ca-mac"
              value={local.mac}
              onChange={(e) => setLocal((x) => ({ ...x, mac: e.target.value }))}
              className="border-neutral-200 font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-tags" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Tags
          </Label>
          <Input
            id="ca-tags"
            value={local.tags}
            onChange={(e) => setLocal((x) => ({ ...x, tags: e.target.value }))}
            className="border-neutral-200"
            placeholder="Separadas por vírgula"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-st" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Situação do acesso
          </Label>
          <Select
            id="ca-st"
            value={local.authOperationalLabel}
            onChange={(e) => setLocal((x) => ({ ...x, authOperationalLabel: e.target.value }))}
            className="border-neutral-200"
          >
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="em_configuracao">Em configuração</option>
          </Select>
          <p className="text-[0.65rem] text-neutral-500">
            Esta situação complementa o estado comercial definido na ficha do cliente.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={local.mikrotikLinked}
            onChange={(e) => setLocal((x) => ({ ...x, mikrotikLinked: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Vincular ao equipamento de rede
        </label>

        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="border-0 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            onClick={handleSave}
          >
            Guardar dados de acesso
          </Button>
        </div>
      </div>
    </Modal>
  );
}
