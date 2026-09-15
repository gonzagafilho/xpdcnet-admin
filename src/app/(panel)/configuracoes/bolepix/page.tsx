"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Eye, ImagePlus, MousePointerClick, Pencil, Plus, Save, ToggleLeft, ToggleRight, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/api-assets";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartnersPanel } from "./partners-panel";

type Category = "institucional" | "upgrade" | "promocao" | "indique_ganhe" | "patrocinado";
type CampaignStatus = "active" | "scheduled" | "inactive" | "ended";

type BolepixAd = {
  _id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  impressions: number;
  clicks: number;
  category: Category;
  sponsorName: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  totalImpressions: number;
  totalClicks: number;
  activeCampaigns: number;
  endedCampaigns: number;
  mostDisplayed: BolepixAd | null;
  items: BolepixAd[];
};

type FormState = {
  title: string;
  category: Category;
  sponsorName: string;
  priority: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  imageDataUrl: string;
  previewUrl: string;
};

const CATEGORY_LABELS: Record<Category, string> = {
  institucional: "Institucional",
  upgrade: "Upgrade",
  promocao: "Promoção",
  indique_ganhe: "Indique e Ganhe",
  patrocinado: "Patrocinado",
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Ativa",
  scheduled: "Agendada",
  inactive: "Inativa",
  ended: "Encerrada",
};

const EMPTY_FORM: FormState = {
  title: "",
  category: "institucional",
  sponsorName: "",
  priority: 1,
  startsAt: "",
  endsAt: "",
  isActive: false,
  imageDataUrl: "",
  previewUrl: "",
};

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

export default function BolepixMarketingPage() {
  const [tab, setTab] = useState<"campaigns" | "partners" | "stats">("campaigns");
  const [items, setItems] = useState<BolepixAd[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [campaigns, metrics] = await Promise.all([
      apiFetch<{ items: BolepixAd[] }>("/bolepix-ads"),
      apiFetch<Stats>("/bolepix-ads/stats"),
    ]);
    setItems(campaigns.items || []);
    setStats(metrics);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((err) => { if (!cancelled) setError(userFacingApiError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const orderedItems = useMemo(() => [...items].sort((a, b) => b.priority - a.priority || b.impressions - a.impressions), [items]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function startEdit(item: BolepixAd) {
    setEditingId(item._id);
    setForm({
      title: item.title,
      category: item.category,
      sponsorName: item.sponsorName || "",
      priority: item.priority || 1,
      startsAt: toLocalInput(item.startsAt),
      endsAt: toLocalInput(item.endsAt),
      isActive: item.isActive,
      imageDataUrl: "",
      previewUrl: item.imageUrl,
    });
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    try {
      const imageDataUrl = await fileAsDataUrl(file);
      setForm((current) => ({ ...current, imageDataUrl, previewUrl: imageDataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler a imagem.");
    }
  }

  async function saveCampaign() {
    if (!form.previewUrl) {
      setError("Selecione uma imagem para a campanha.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = JSON.stringify({
        title: form.title.trim() || "Banner promocional",
        category: form.category,
        sponsorName: form.sponsorName.trim(),
        priority: form.priority,
        startsAt: toIsoOrNull(form.startsAt),
        endsAt: toIsoOrNull(form.endsAt),
        isActive: form.isActive,
        imageDataUrl: form.imageDataUrl || undefined,
      });
      if (editingId) {
        await apiFetch(`/bolepix-ads/${editingId}`, { method: "PUT", body, retry: false, timeoutMs: 30_000 });
      } else {
        await apiFetch("/bolepix-ads", { method: "POST", body, retry: false, timeoutMs: 30_000 });
      }
      await load();
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSuccess(editingId ? "Campanha atualizada." : "Campanha criada.");
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: BolepixAd) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/bolepix-ads/${item._id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
        retry: false,
      });
      await load();
      setSuccess(item.isActive ? "Campanha desativada." : "Campanha ativada.");
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeCampaign(item: BolepixAd) {
    if (!window.confirm(`Excluir a campanha “${item.title}”?`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/bolepix-ads/${item._id}`, { method: "DELETE", retry: false });
      await load();
      setSuccess("Campanha excluída.");
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando Central de Marketing BolePix…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <ImagePlus className="h-5 w-5 text-emerald-700" /> Central de Marketing BolePix
          </h1>
          <p className="mt-1 text-sm text-slate-600">Campanhas rotativas com prioridade, patrocinadores e métricas de exibição.</p>
        </div>
        {tab === "campaigns" ? <Button type="button" onClick={startCreate}><Plus className="h-4 w-4" /> Nova campanha</Button> : null}
      </div>

      <div className="flex border-b border-slate-200">
        <button type="button" onClick={() => setTab("campaigns")} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === "campaigns" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"}`}>Campanhas</button>
        <button type="button" onClick={() => setTab("partners")} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === "partners" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"}`}>Parceiros</button>
        <button type="button" onClick={() => setTab("stats")} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === "stats" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"}`}>Estatísticas</button>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p> : null}

      {tab === "partners" ? <PartnersPanel /> : tab === "campaigns" ? (
        <div className="space-y-5">
          {formOpen ? (
            <Card>
              <CardHeader><CardTitle className="text-base">{editingId ? "Editar campanha" : "Nova campanha"}</CardTitle></CardHeader>
              <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-4">
                  <div><Label htmlFor="campaign-title">Título</Label><Input id="campaign-title" maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="campaign-category">Categoria</Label>
                      <select id="campaign-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div><Label htmlFor="campaign-sponsor">Patrocinador</Label><Input id="campaign-sponsor" maxLength={120} value={form.sponsorName} onChange={(event) => setForm((current) => ({ ...current, sponsorName: event.target.value }))} /></div>
                    <div><Label htmlFor="campaign-priority">Prioridade (1–100)</Label><Input id="campaign-priority" type="number" min={1} max={100} value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value || 1) }))} /></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="campaign-start">Início</Label><Input id="campaign-start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
                    <div><Label htmlFor="campaign-end">Término</Label><Input id="campaign-end" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Campanha ativa</label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50">
                    <Upload className="h-4 w-4" /> {form.previewUrl ? "Substituir imagem" : "Selecionar imagem"}
                    <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageChange} />
                  </label>
                  <div className="flex gap-3">
                    <Button type="button" onClick={() => void saveCampaign()} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar campanha"}</Button>
                    <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); }} disabled={saving}>Cancelar</Button>
                  </div>
                </div>
                <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-inner">
                  {form.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveApiAssetUrl(form.previewUrl)} alt={form.title || "Preview da campanha"} className="max-h-[300px] w-full object-contain" />
                  ) : <div className="text-center text-sm text-slate-400"><ImagePlus className="mx-auto mb-2 h-8 w-8" />Preview da campanha</div>}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {orderedItems.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {orderedItems.map((item) => (
                <Card key={item._id}>
                  <CardContent className="p-4">
                    <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
                      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveApiAssetUrl(item.imageUrl)} alt={item.title} className="h-32 w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><h2 className="font-bold text-slate-900">{item.title}</h2><p className="text-xs text-slate-500">{CATEGORY_LABELS[item.category]}{item.sponsorName ? ` · ${item.sponsorName}` : ""}</p></div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : item.status === "ended" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{STATUS_LABELS[item.status]}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                          <div><strong className="block text-slate-900">{item.priority}</strong>Prioridade</div>
                          <div><strong className="block text-slate-900">{formatNumber(item.impressions)}</strong>Exibições</div>
                          <div><strong className="block text-slate-900">{formatNumber(item.clicks)}</strong>Cliques</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void toggleActive(item)} disabled={saving}>{item.isActive ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> : <ToggleLeft className="h-3.5 w-3.5" />}{item.isActive ? "Desativar" : "Ativar"}</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void removeCampaign(item)} disabled={saving} className="text-red-700"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <div className="rounded-md border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Nenhuma campanha criada.</div>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Eye} label="Total de visualizações" value={formatNumber(stats?.totalImpressions || 0)} />
            <MetricCard icon={BarChart3} label="Banner mais exibido" value={stats?.mostDisplayed?.title || "—"} hint={stats?.mostDisplayed ? `${formatNumber(stats.mostDisplayed.impressions)} exibições` : undefined} />
            <MetricCard icon={ToggleRight} label="Campanhas ativas" value={formatNumber(stats?.activeCampaigns || 0)} />
            <MetricCard icon={ToggleLeft} label="Campanhas encerradas" value={formatNumber(stats?.endedCampaigns || 0)} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Desempenho das campanhas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="py-2">Campanha</th><th>Categoria</th><th>Patrocinador</th><th className="text-right">Prioridade</th><th className="text-right">Exibições</th><th className="text-right">Cliques</th></tr></thead>
                <tbody>{orderedItems.map((item) => <tr key={item._id} className="border-b border-slate-100"><td className="py-3 font-medium text-slate-900">{item.title}</td><td>{CATEGORY_LABELS[item.category]}</td><td>{item.sponsorName || "—"}</td><td className="text-right">{item.priority}</td><td className="text-right">{formatNumber(item.impressions)}</td><td className="text-right">{formatNumber(item.clicks)}</td></tr>)}</tbody>
              </table>
            </CardContent>
          </Card>
          <p className="flex items-center gap-2 text-xs text-slate-500"><MousePointerClick className="h-3.5 w-3.5" /> A métrica de cliques está preparada para futuras campanhas com destino externo.</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: string; hint?: string }) {
  return <Card><CardContent className="flex items-start gap-3 p-4"><div className="rounded-md bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-bold text-slate-900">{value}</p>{hint ? <p className="text-xs text-slate-500">{hint}</p> : null}</div></CardContent></Card>;
}
