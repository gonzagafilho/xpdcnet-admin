"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { MikrotikServerFromApi, NetworkNodeFromApi } from "@/lib/api-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = novo cadastro */
  serverId: string | null;
  onSaved?: () => void;
};

type ExecutionMode = "auto" | "direct" | "agent";

export function ServerFormModal({ open, onOpenChange, serverId, onSaved }: Props) {
  const isEdit = Boolean(serverId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<NetworkNodeFromApi[]>([]);

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8728");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("auto");
  const [agentId, setAgentId] = useState("");
  const [networkNodeId, setNetworkNodeId] = useState("");

  const loadNodes = useCallback(async () => {
    try {
      const list = await apiFetch<NetworkNodeFromApi[]>("/network-nodes", { auth: true, timeoutMs: 60_000 });
      setNodes(Array.isArray(list) ? list : []);
    } catch {
      setNodes([]);
    }
  }, []);

  const resetEmpty = () => {
    setName("");
    setHost("");
    setPort("8728");
    setUsername("");
    setPassword("");
    setIsActive(true);
    setExecutionMode("auto");
    setAgentId("");
    setNetworkNodeId("");
    setError(null);
  };

  const loadServer = useCallback(async () => {
    if (!serverId) {
      resetEmpty();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<MikrotikServerFromApi>(`/mikrotik/servers/${encodeURIComponent(serverId)}`, {
        auth: true,
        timeoutMs: 60_000,
      });
      setName(row.name || "");
      setHost(row.host || "");
      setPort(String(row.port ?? 8728));
      setUsername(row.username ?? "");
      setPassword("");
      setIsActive(row.isActive !== false);
      const m = row.executionMode;
      setExecutionMode(m === "direct" || m === "agent" ? m : "auto");
      setAgentId(row.agentId ? String(row.agentId) : "");
      setNetworkNodeId(row.networkNodeId ? String(row.networkNodeId) : "");
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao carregar servidor.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (!open) return;
    void loadNodes();
    void loadServer();
  }, [open, loadNodes, loadServer]);

  const remoteAgents = nodes.filter((n) => n.type === "REMOTE_AGENT");

  const submit = async () => {
    setError(null);
    if (!name.trim() || !host.trim()) {
      setError("Nome e host são obrigatórios.");
      return;
    }
    if (!isEdit && !password.trim()) {
      setError("Defina uma senha de acesso para o novo equipamento.");
      return;
    }
    if (executionMode === "agent" && !agentId.trim() && !networkNodeId.trim()) {
      setError("Em modo agente, seleccione o agente remoto (ou um node POP que seja o agente).");
      return;
    }

    const p = Number(port);
    const body: Record<string, unknown> = {
      name: name.trim(),
      host: host.trim(),
      port: Number.isFinite(p) ? p : 8728,
      username: username.trim(),
      isActive,
      executionMode,
      networkNodeId: networkNodeId.trim() || null,
      agentId: executionMode === "agent" ? agentId.trim() || null : null,
    };
    if (password.trim()) {
      body.password = password.trim();
    }

    setSaving(true);
    try {
      if (isEdit && serverId) {
        await apiFetch(`/mikrotik/servers/${encodeURIComponent(serverId)}`, {
          method: "PUT",
          auth: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/mikrotik/servers", {
          method: "POST",
          auth: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, password: password.trim() }),
        });
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Falha ao gravar.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar servidor MikroTik" : "Novo servidor MikroTik"}
      description="Informe dados e origem da ligação."
      className="max-w-lg"
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          A carregar…
        </div>
      ) : (
        <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Host / IP</label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Porta de acesso</label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Usuário de acesso</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">
              Senha de acesso {isEdit ? "(vazio = manter actual)" : ""}
            </label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="srv-active"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="srv-active" className="text-sm text-slate-700">
              Servidor activo
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Modo de execução</label>
            <Select value={executionMode} onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)}>
              <option value="auto">auto — segue node do cliente/servidor (legado)</option>
              <option value="direct">Direto — ligação realizada pela matriz</option>
              <option value="agent">agent — sempre via agente remoto (LAN na filial)</option>
            </Select>
            <p className="text-[11px] leading-relaxed text-slate-500">
              <strong>direct</strong> não usa agente. <strong>agent</strong> exige agente com heartbeat. <strong>auto</strong> mantém
              compatibilidade com instalações existentes.
            </p>
          </div>

          {executionMode === "agent" ? (
            <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
              <p className="text-[11px] font-semibold text-amber-950">Execução remota</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Agente remoto (REMOTE_AGENT)</label>
                <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  <option value="">— seleccionar —</option>
                  {remoteAgents.map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.name} · {n.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Ou node POP (se o agente está referenciado aqui)</label>
                <Select value={networkNodeId} onChange={(e) => setNetworkNodeId(e.target.value)}>
                  <option value="">— nenhum / usar só agente acima —</option>
                  {nodes.map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.name} · {n.code} ({n.type})
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-[11px] text-slate-600">
                Selecione ao menos uma unidade remota disponível para realizar a ligação (o sistema
                valida).
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Node POP / referência (opcional)</label>
              <Select value={networkNodeId} onChange={(e) => setNetworkNodeId(e.target.value)}>
                <option value="">— nenhum —</option>
                {nodes.map((n) => (
                  <option key={n._id} value={n._id}>
                    {n.name} · {n.code} ({n.type})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={() => void submit()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Gravar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
