"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { ImagePlus, Save, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BolepixAd = {
  _id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdResponse = { ad: BolepixAd | null };

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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

export default function BolepixBannerPage() {
  const [ad, setAd] = useState<BolepixAd | null>(null);
  const [title, setTitle] = useState("Banner promocional");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const applyAd = useCallback((item: BolepixAd | null) => {
    setAd(item);
    setTitle(item?.title || "Banner promocional");
    setStartsAt(toLocalInput(item?.startsAt || null));
    setEndsAt(toLocalInput(item?.endsAt || null));
    setPreviewUrl(item?.imageUrl || "");
    setImageDataUrl("");
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const payload = await apiFetch<AdResponse>("/bolepix-ads");
    applyAd(payload.ad);
  }, [applyAd]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((err) => {
        if (!cancelled) setError(userFacingApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Selecione uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await fileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setPreviewUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler a imagem.");
    }
  }

  async function save() {
    if (!previewUrl) {
      setError("Selecione uma imagem para o banner.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = await apiFetch<AdResponse>("/bolepix-ads", {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim() || "Banner promocional",
          imageDataUrl: imageDataUrl || undefined,
          isActive: ad?.isActive === true,
          startsAt: toIsoOrNull(startsAt),
          endsAt: toIsoOrNull(endsAt),
        }),
        retry: false,
        timeoutMs: 30_000,
      });
      applyAd(payload.ad);
      setSuccess("Banner do BolePix salvo com sucesso.");
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!ad) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = await apiFetch<AdResponse>("/bolepix-ads/active", {
        method: "PATCH",
        body: JSON.stringify({ isActive: !ad.isActive }),
        retry: false,
      });
      applyAd(payload.ad);
      setSuccess(payload.ad?.isActive ? "Banner ativado." : "Banner desativado.");
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando banner do BolePix…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          <ImagePlus className="h-5 w-5 text-emerald-700" /> Banner promocional do BolePix
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          A imagem ativa aparece no documento do cliente e permanece compacta na impressão A4.
        </p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="bolepix-ad-title">Título interno</Label>
              <Input id="bolepix-ad-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Usado como descrição da imagem para acessibilidade.</p>
            </div>

            <div>
              <Label htmlFor="bolepix-ad-image">Imagem promocional</Label>
              <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50">
                <Upload className="h-4 w-4" /> Selecionar JPG, PNG ou WebP
                <input id="bolepix-ad-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageChange} />
              </label>
              <p className="mt-1 text-xs text-slate-500">Máximo de 5 MB. Formato horizontal recomendado.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bolepix-ad-start">Exibir a partir de</Label>
                <Input id="bolepix-ad-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="bolepix-ad-end">Exibir até</Label>
                <Input id="bolepix-ad-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void save()} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar banner"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void toggleActive()} disabled={saving || !ad}>
                {ad?.isActive ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />}
                {ad?.isActive ? "Desativar" : "Ativar"}
              </Button>
            </div>

            {ad ? (
              <p className="text-xs text-slate-500">
                Status: <strong className={ad.isActive ? "text-emerald-700" : "text-slate-700"}>{ad.isActive ? "ativo" : "inativo"}</strong>
                {ad.updatedAt ? ` · Atualizado em ${new Date(ad.updatedAt).toLocaleString("pt-BR")}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview no documento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-inner">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={title || "Banner promocional"} className="max-h-[320px] w-full object-contain" />
              ) : (
                <div className="text-center text-sm text-slate-400">
                  <ImagePlus className="mx-auto mb-2 h-8 w-8" /> Nenhuma imagem selecionada
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
