"use client";
/* eslint-disable @next/next/no-img-element */
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { Eye, ImagePlus, MousePointerClick, Pencil, Plus, Save, ToggleLeft, ToggleRight, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/api-assets";
import { userFacingApiError } from "@/lib/user-facing-api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Partner = { _id:string; name:string; category:string; imageUrl:string; whatsapp:string; website:string; priority:number; startsAt:string|null; endsAt:string|null; isActive:boolean; impressions:number; clicks:number; lastDisplayedAt:string|null; status:"active"|"scheduled"|"inactive"|"ended" };
type Form = { name:string; category:string; whatsapp:string; website:string; priority:number; startsAt:string; endsAt:string; isActive:boolean; imageDataUrl:string; previewUrl:string };
const EMPTY: Form = { name:"", category:"Comércio local", whatsapp:"", website:"", priority:1, startsAt:"", endsAt:"", isActive:false, imageDataUrl:"", previewUrl:"" };
function localDate(v:string|null){ if(!v)return ""; const d=new Date(v); return Number.isNaN(d.getTime())?"":new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
function iso(v:string){ return v?new Date(v).toISOString():null; }
function number(v:number){ return new Intl.NumberFormat("pt-BR").format(v||0); }
function fileData(file:File){ return new Promise<string>((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||"")); r.onerror=()=>reject(new Error("Falha ao ler imagem.")); r.readAsDataURL(file); }); }

export function PartnersPanel(){
  const [items,setItems]=useState<Partner[]>([]); const [open,setOpen]=useState(false); const [editing,setEditing]=useState<string|null>(null); const [form,setForm]=useState<Form>(EMPTY); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [success,setSuccess]=useState<string|null>(null);
  const load=useCallback(async()=>{ const data=await apiFetch<{items:Partner[]}>("/bolepix-partners"); setItems(data.items||[]); },[]);
  useEffect(()=>{ void load().catch(e=>setError(userFacingApiError(e))); },[load]);
  function create(){ setEditing(null); setForm(EMPTY); setOpen(true); setError(null); }
  function edit(p:Partner){ setEditing(p._id); setForm({name:p.name,category:p.category,whatsapp:p.whatsapp||"",website:p.website||"",priority:p.priority,startsAt:localDate(p.startsAt),endsAt:localDate(p.endsAt),isActive:p.isActive,imageDataUrl:"",previewUrl:p.imageUrl}); setOpen(true); }
  async function image(e:ChangeEvent<HTMLInputElement>){ const f=e.target.files?.[0]; if(!f)return; if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>5*1024*1024){setError("Use JPG, PNG ou WebP de até 5 MB.");return;} const dataUrl=await fileData(f); setForm(x=>({...x,imageDataUrl:dataUrl,previewUrl:dataUrl})); }
  async function save(){ if(!form.previewUrl){setError("Selecione uma imagem.");return;} setBusy(true);setError(null); try{const body=JSON.stringify({...form,startsAt:iso(form.startsAt),endsAt:iso(form.endsAt),imageDataUrl:form.imageDataUrl||undefined}); await apiFetch(editing?`/bolepix-partners/${editing}`:"/bolepix-partners",{method:editing?"PUT":"POST",body,retry:false,timeoutMs:30000}); await load();setOpen(false);setSuccess(editing?"Parceiro atualizado.":"Parceiro criado.");}catch(e){setError(userFacingApiError(e));}finally{setBusy(false);} }
  async function toggle(p:Partner){setBusy(true);try{await apiFetch(`/bolepix-partners/${p._id}/active`,{method:"PATCH",body:JSON.stringify({isActive:!p.isActive}),retry:false});await load();}catch(e){setError(userFacingApiError(e));}finally{setBusy(false);}}
  async function remove(p:Partner){if(!confirm(`Excluir ${p.name}?`))return;setBusy(true);try{await apiFetch(`/bolepix-partners/${p._id}`,{method:"DELETE",retry:false});await load();}catch(e){setError(userFacingApiError(e));}finally{setBusy(false);}}
  return <div className="space-y-5">
    <div className="flex justify-end"><Button onClick={create}><Plus className="h-4 w-4"/>Novo parceiro</Button></div>
    {error?<p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>:null}{success?<p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">{success}</p>:null}
    {open?<Card><CardHeader><CardTitle className="text-base">{editing?"Editar parceiro":"Novo parceiro"}</CardTitle></CardHeader><CardContent className="grid gap-5 xl:grid-cols-[1fr_360px]"><div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><div><Label>Nome</Label><Input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></div><div><Label>Categoria</Label><Input value={form.category} onChange={e=>setForm(x=>({...x,category:e.target.value}))}/></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><div><Label>WhatsApp</Label><Input placeholder="5561999999999" value={form.whatsapp} onChange={e=>setForm(x=>({...x,whatsapp:e.target.value}))}/></div><div><Label>Website</Label><Input placeholder="https://" value={form.website} onChange={e=>setForm(x=>({...x,website:e.target.value}))}/></div><div><Label>Prioridade</Label><Input type="number" min={1} max={100} value={form.priority} onChange={e=>setForm(x=>({...x,priority:Number(e.target.value||1)}))}/></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label>Início</Label><Input type="datetime-local" value={form.startsAt} onChange={e=>setForm(x=>({...x,startsAt:e.target.value}))}/></div><div><Label>Término</Label><Input type="datetime-local" value={form.endsAt} onChange={e=>setForm(x=>({...x,endsAt:e.target.value}))}/></div></div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e=>setForm(x=>({...x,isActive:e.target.checked}))}/>Parceiro ativo</label>
      <label className="flex cursor-pointer justify-center gap-2 rounded border border-dashed p-5 text-sm"><Upload className="h-4 w-4"/>{form.previewUrl?"Substituir imagem":"Enviar imagem"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={image}/></label>
      <div className="flex gap-2"><Button onClick={()=>void save()} disabled={busy}><Save className="h-4 w-4"/>Salvar</Button><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button></div>
    </div><div className="flex min-h-52 items-center justify-center overflow-hidden rounded border bg-slate-50">{form.previewUrl?<img src={resolveApiAssetUrl(form.previewUrl)} alt="Preview" className="max-h-72 w-full object-contain"/>:<ImagePlus className="h-10 w-10 text-slate-300"/>}</div></CardContent></Card>:null}
    <div className="grid gap-4 lg:grid-cols-2">{items.map(p=><Card key={p._id}><CardContent className="grid gap-4 p-4 sm:grid-cols-[130px_1fr]"><img src={resolveApiAssetUrl(p.imageUrl)} alt={p.name} className="h-28 w-full rounded object-cover"/><div><div className="flex justify-between gap-2"><div><h3 className="font-bold">{p.name}</h3><p className="text-xs text-slate-500">{p.category}</p></div><span className="text-xs font-semibold">{p.status}</span></div><div className="mt-3 grid grid-cols-3 text-xs"><span><strong className="block">{p.priority}</strong>Prioridade</span><span><strong className="block">{number(p.impressions)}</strong><Eye className="inline h-3 w-3"/> Impressões</span><span><strong className="block">{number(p.clicks)}</strong><MousePointerClick className="inline h-3 w-3"/> Cliques</span></div><p className="mt-2 text-xs text-slate-500">Última exibição: {p.lastDisplayedAt?new Date(p.lastDisplayedAt).toLocaleString("pt-BR"):"Nunca"}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>edit(p)}><Pencil className="h-3 w-3"/>Editar</Button><Button size="sm" variant="outline" onClick={()=>void toggle(p)} disabled={busy}>{p.isActive?<ToggleRight className="h-3 w-3"/>:<ToggleLeft className="h-3 w-3"/>}{p.isActive?"Desativar":"Ativar"}</Button><Button size="sm" variant="outline" className="text-red-700" onClick={()=>void remove(p)}><Trash2 className="h-3 w-3"/>Excluir</Button></div></div></CardContent></Card>)}</div>
    {!items.length?<div className="rounded border border-dashed p-10 text-center text-sm text-slate-500">Nenhum parceiro cadastrado.</div>:null}
  </div>;
}
