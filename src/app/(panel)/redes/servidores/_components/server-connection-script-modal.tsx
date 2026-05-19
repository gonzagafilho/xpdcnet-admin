"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ClipboardCopy, FileCode2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api-client";
import type { MikrotikServerFromApi } from "@/lib/api-types";
import {
  buildMikrotikActivationScript,
  buildMikrotikDeactivationScript,
  MIKROTIK_XPDCNET_ADDRESS_LIST_NAME,
  MIKROTIK_XPDCNET_GROUP_NAME,
} from "../_lib/mikrotik-connection-script";

export type ServerConnectionScriptSeed = {
  serverId?: string;
  serverName?: string;
  defaultHost?: string;
  defaultPort?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: ServerConnectionScriptSeed | null;
};

type Mode = "activate" | "deactivate";

const DEFAULT_COMMENT = "XPDCNET LAB";

export function ServerConnectionScriptModal({ open, onOpenChange, seed }: Props) {
  const formId = useId();
  const [mode, setMode] = useState<Mode>("activate");
  const [allowedServerIp, setAllowedServerIp] = useState("");
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [commentTag, setCommentTag] = useState(DEFAULT_COMMENT);
  const [apiPort, setApiPort] = useState("8728");
  const [disableApiService, setDisableApiService] = useState(false);
  const [clearApiServiceAddress, setClearApiServiceAddress] = useState(false);
  const [scriptOut, setScriptOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const resetForSeed = useCallback(() => {
    setMode("activate");
    setAllowedServerIp("");
    setApiUsername("");
    setApiPassword("");
    setCommentTag(DEFAULT_COMMENT);
    setApiPort(seed?.defaultPort != null && Number.isFinite(seed.defaultPort) ? String(seed.defaultPort) : "8728");
    setDisableApiService(false);
    setClearApiServiceAddress(false);
    setScriptOut("");
    setError(null);
    setHint(null);
  }, [seed?.defaultPort]);

  useEffect(() => {
    if (!open) return;
    resetForSeed();
  }, [open, seed, resetForSeed]);

  useEffect(() => {
    if (!open || !seed?.serverId) return;
    let cancelled = false;
    setLoadingUser(true);
    void (async () => {
      try {
        const row = await apiFetch<MikrotikServerFromApi>(`/mikrotik/servers/${encodeURIComponent(seed.serverId!)}`, {
          auth: true,
          timeoutMs: 60_000,
        });
        if (cancelled) return;
        setApiUsername(row.username?.trim() || "");
        if (seed.defaultPort == null && row.port != null) {
          setApiPort(String(row.port));
        }
      } catch {
        if (!cancelled) setApiUsername("");
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, seed?.serverId, seed?.defaultPort]);

  const equipmentLabel = seed?.serverName?.trim() || seed?.defaultHost || "";

  const handleGenerate = () => {
    setError(null);
    setHint(null);
    try {
      if (mode === "activate") {
        const p = Number(apiPort);
        const text = buildMikrotikActivationScript({
          allowedServerIp,
          apiUsername,
          apiPassword,
          commentTag,
          apiPort: p,
          equipmentLabel: equipmentLabel || undefined,
        });
        setScriptOut(text);
        setHint("Script de ativação gerado. Revise e cole no terminal do MikroTik.");
      } else {
        const text = buildMikrotikDeactivationScript({
          commentTag,
          disableApiService,
          clearApiServiceAddress,
        });
        setScriptOut(text);
        setHint("Script de desativação gerado. Remove apenas o criado pelo XPDCNET com o mesmo comentário.");
      }
    } catch (e) {
      setScriptOut("");
      setError(e instanceof Error ? e.message : "Não foi possível gerar o script.");
    }
  };

  const handleCopy = async () => {
    setHint(null);
    if (!scriptOut.trim()) {
      setError("Gere o script antes de copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(scriptOut);
      setHint("Copiado para a área de transferência.");
    } catch {
      setError("Não foi possível copiar. Seleccione o texto manualmente.");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Script de conexão"
      description="Este script cria acesso seguro para o XPDCNET monitorar este MikroTik pela API, sem alterar clientes ou a configuração operacional do provedor."
      className="max-w-2xl"
    >
      <div className="mt-4 space-y-4">
        <p className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm leading-relaxed text-slate-700">
          Este script cria um acesso seguro para o XPDCNET ler informações do MikroTik. Ele não altera clientes, não mexe
          no PPPoE, não muda internet, não mexe em bridge, VLAN ou rotas. Ele cria apenas: um utilizador dedicado, um
          grupo dedicado, uma liberação controlada da API e uma regra de firewall específica.
        </p>

        {seed?.serverId ? (
          <p className="text-xs text-slate-500">
            Servidor: <span className="font-semibold text-slate-700">{seed.serverName || seed.serverId}</span>
            {loadingUser ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> A carregar utilizador API do cadastro…
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              mode === "activate" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => {
              setMode("activate");
              setError(null);
            }}
          >
            Modo: Ativar monitoramento
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              mode === "deactivate" ? "bg-slate-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => {
              setMode("deactivate");
              setError(null);
            }}
          >
            Modo: Desativar monitoramento
          </button>
        </div>

        {mode === "activate" ? (
          <form
            id={formId}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor={`${formId}-allow`}>
                IP permitido do servidor XPDCNET
              </label>
              <Input
                id={`${formId}-allow`}
                className="font-mono text-sm"
                placeholder="ex.: 203.0.113.10"
                value={allowedServerIp}
                onChange={(e) => setAllowedServerIp(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[11px] text-slate-500">Endereço a partir do qual a API RouterOS aceita ligações.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600" htmlFor={`${formId}-user`}>
                  Utilizador da API
                </label>
                <Input
                  id={`${formId}-user`}
                  className="font-mono text-sm"
                  placeholder="ex.: xpdcnet-lab"
                  value={apiUsername}
                  onChange={(e) => setApiUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600" htmlFor={`${formId}-port`}>
                  Porta da API
                </label>
                <Input
                  id={`${formId}-port`}
                  inputMode="numeric"
                  className="font-mono text-sm"
                  value={apiPort}
                  onChange={(e) => setApiPort(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor={`${formId}-pass`}>
                Senha da API
              </label>
              <Input
                id={`${formId}-pass`}
                type="password"
                className="font-mono text-sm"
                value={apiPassword}
                onChange={(e) => setApiPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor={`${formId}-tag`}>
                Comentário / identificador (exacto no MikroTik)
              </label>
              <Input
                id={`${formId}-tag`}
                value={commentTag}
                onChange={(e) => setCommentTag(e.target.value)}
                placeholder={DEFAULT_COMMENT}
                autoComplete="off"
              />
              <p className="text-[11px] text-slate-500">
                Usado em comentários para poder remover com segurança no script de desativação. Grupo:{" "}
                <span className="font-mono">{MIKROTIK_XPDCNET_GROUP_NAME}</span> · lista:{" "}
                <span className="font-mono">{MIKROTIK_XPDCNET_ADDRESS_LIST_NAME}</span>.
              </p>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Este script remove apenas o acesso criado para o XPDCNET monitorar o MikroTik (mesmo comentário, lista e
              grupo dedicados).
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600" htmlFor={`${formId}-tag2`}>
                Comentário usado na ativação
              </label>
              <Input
                id={`${formId}-tag2`}
                value={commentTag}
                onChange={(e) => setCommentTag(e.target.value)}
                autoComplete="off"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                checked={clearApiServiceAddress}
                onChange={(e) => setClearApiServiceAddress(e.target.checked)}
              />
              <span>
                Limpar restrição de IP do serviço API (<span className="font-mono">address</span> vazio — aceita de
                qualquer origem). Use só se souber o impacto.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                checked={disableApiService}
                onChange={(e) => setDisableApiService(e.target.checked)}
              />
              <span>
                Desactivar o serviço API no router (<span className="font-mono">disabled=yes</span>). Opcional; pode
                afectar outras integrações.
              </span>
            </label>
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
            {error}
          </div>
        ) : null}
        {hint ? <p className="text-xs text-emerald-800">{hint}</p> : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">O que será criado no MikroTik (ativação)</p>
          <ul className="mt-1 list-inside list-disc">
            <li>Utilizador dedicado (comentário identificável)</li>
            <li>Grupo dedicado ({MIKROTIK_XPDCNET_GROUP_NAME})</li>
            <li>Serviço API activo, porta configurada, origem restrita ao IP do XPDCNET</li>
            <li>Address-list e regra de firewall de entrada específica</li>
          </ul>
          <p className="mt-2 font-semibold text-slate-800">O que não será alterado</p>
          <ul className="mt-1 list-inside list-disc">
            <li>Clientes, PPPoE, secrets, pools</li>
            <li>Rotas, bridge, VLAN, DNS</li>
            <li>Internet ou tráfego alheio à API</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleGenerate}>
            <FileCode2 className="h-4 w-4" aria-hidden />
            {mode === "activate" ? "Gerar script de ativação" : "Gerar script de desativação"}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleCopy()} disabled={!scriptOut}>
            <ClipboardCopy className="h-4 w-4" aria-hidden />
            Copiar script
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Script RouterOS</label>
          <textarea
            readOnly
            className={cn(
              "min-h-[220px] w-full resize-y rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1",
            )}
            value={scriptOut}
            placeholder="Clique em «Gerar script…» para preencher."
            spellCheck={false}
          />
        </div>
      </div>
    </Modal>
  );
}
