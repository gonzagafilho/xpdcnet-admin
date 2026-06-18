"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Copy,
  FileText,
  Mail,
  MapPin,
  Phone,
  Printer,
  QrCode,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerApiError, customerApiFetch, getCustomerToken } from "@/lib/customer-app-api";

type InvoiceItem = {
  _id: string;
  amount: number;
  dueDate: string | null;
  status: string;
  paidAt?: string | null;
  competence: string;
  description?: string;
  hasBillingInvoice: boolean;
  billingInvoiceId: string | null;
  billingStatus: string | null;
};

type PaymentResponse = {
  invoice: InvoiceItem;
  payment: {
    _id: string;
    providerChargeId?: string;
    providerStatus: string;
    internalStatus: string;
    gateway?: string;
    amount?: number;
    dueDate?: string | null;
    paidAt?: string | null;
    checkoutUrl?: string;
    pixPayload?: string;
    pixCopyPaste?: string;
    pixQrCodeUrl?: string;
  } | null;
  canIssueNewCharge: boolean;
};

type CustomerDashboard = {
  client: {
    _id: string;
    fullName: string;
    email?: string;
    phone?: string;
    status: string;
    address?: {
      city?: string;
      state?: string;
      neighborhood?: string;
    };
  };
  plan: {
    _id: string;
    name: string;
    speedMbps: number;
  } | null;
};

const COMPANY = {
  cnpj: process.env.NEXT_PUBLIC_DCNET_CNPJ || "",
  whatsapp: process.env.NEXT_PUBLIC_DCNET_WHATSAPP || "(61) 99662-7145",
  email: process.env.NEXT_PUBLIC_DCNET_EMAIL || "",
  address: process.env.NEXT_PUBLIC_DCNET_ADDRESS || "",
};

function money(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
}

function statusLabel(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (["approved", "paid"].includes(normalized)) return "Pago";
  if (normalized === "overdue") return "Vencido";
  if (["cancelled", "canceled"].includes(normalized)) return "Cancelado";
  if (normalized === "in_process") return "Em processamento";
  return "Pendente";
}

function customerAddress(customer?: CustomerDashboard["client"] | null) {
  const parts = [customer?.address?.neighborhood, customer?.address?.city, customer?.address?.state].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Não informado no portal";
}

function LoadingDocument() {
  return (
    <main className="min-h-screen bg-[#eef4f7] px-4 py-8">
      <div className="mx-auto max-w-[960px] animate-pulse overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(2,6,23,0.45)] sm:p-10">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-7">
          <div className="h-16 w-16 rounded-lg bg-slate-200" />
          <div className="space-y-3">
            <div className="h-6 w-52 rounded bg-slate-200" />
            <div className="h-4 w-36 rounded bg-slate-100" />
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 rounded bg-slate-100" />)}
        </div>
        <div className="mt-8 h-48 rounded bg-slate-100" />
        <div className="mt-8 h-72 rounded bg-slate-100" />
      </div>
      <p className="mt-5 text-center text-sm font-medium text-slate-500">Preparando seu BolePix DC NET...</p>
    </main>
  );
}

export default function BolepixPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const invoiceId = Array.isArray(params.invoiceId) ? params.invoiceId[0] : params.invoiceId;
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [dashboard, setDashboard] = useState<CustomerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    if (!getCustomerToken()) {
      router.replace("/cliente");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [paymentData, dashboardData] = await Promise.all([
        customerApiFetch<PaymentResponse>(`/customer-app/invoices/${invoiceId}/payment`),
        customerApiFetch<CustomerDashboard>("/customer-app/me"),
      ]);
      setPayment(paymentData);
      setDashboard(dashboardData);
    } catch (err) {
      if (err instanceof CustomerApiError && err.status === 401) {
        router.replace("/cliente");
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível carregar esta cobrança.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const invoice = payment?.invoice;
  const pix = payment?.payment;
  const pixCode = pix?.pixCopyPaste || pix?.pixPayload || "";
  const qrCode = pix?.pixQrCodeUrl || "";
  const description = invoice?.description || "Mensalidade de internet DC NET";
  const chargeNumber = pix?.providerChargeId || invoice?._id || invoiceId || "";
  const displayedStatus = statusLabel(pix?.internalStatus || invoice?.status);
  const chargeAmount = Number(pix?.amount ?? invoice?.amount ?? 0);
  const chargeDueDate = pix?.dueDate || invoice?.dueDate;
  const customer = dashboard?.client;
  const planLabel = useMemo(() => {
    if (!dashboard?.plan) return "Não informado no portal";
    return `${dashboard.plan.name}${dashboard.plan.speedMbps ? ` · ${dashboard.plan.speedMbps} Mbps` : ""}`;
  }, [dashboard]);

  async function copyPix() {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o código Pix manualmente.");
    }
  }

  if (loading) return <LoadingDocument />;

  if (error && !payment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <section className="w-full max-w-lg border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950">Não foi possível abrir o BolePix</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push("/cliente")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <Button onClick={() => void load()}>Tentar novamente</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bolepix-page min-h-screen bg-[#edf3f6] px-3 py-5 text-slate-950 sm:px-6 sm:py-10">
      <div className="bolepix-actions mx-auto mb-4 flex max-w-[960px] flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => router.push("/cliente")} className="border-slate-300 bg-white shadow-sm hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Voltar ao Portal</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyPix} disabled={!pixCode} className="border-slate-300 bg-white shadow-sm hover:bg-slate-50"><Copy className="h-4 w-4" /> Copiar Pix</Button>
          <Button onClick={() => window.print()} className="bg-[#063b4a] text-white shadow-sm hover:bg-[#052f3b]"><Printer className="h-4 w-4" /> Imprimir / Salvar PDF</Button>
        </div>
      </div>

      <article className="bolepix-document mx-auto max-w-[960px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_30px_90px_-45px_rgba(2,6,23,0.5)]">
        <header className="bolepix-header grid gap-7 bg-[linear-gradient(118deg,#061b34_0%,#063b4a_48%,#087f75_100%)] p-5 text-white sm:grid-cols-[1fr_320px] sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white p-1.5 shadow-lg shadow-black/15 sm:h-20 sm:w-20">
              <Image src="/icons/dcnet-client.svg" alt="DC NET" width={80} height={80} priority className="h-full w-full rounded-md" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-cyan-200">DC NET</p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">BolePix DC NET</h1>
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/40 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase text-cyan-50">
                <ShieldCheck className="h-3.5 w-3.5" /> Pagamento via Pix
              </span>
            </div>
          </div>
          <div className="rounded-md border border-white/20 bg-black/10 p-4 text-sm text-cyan-50 backdrop-blur-sm sm:text-right">
            {COMPANY.cnpj ? <p><span className="font-semibold text-white">CNPJ:</span> {COMPANY.cnpj}</p> : null}
            <p className="inline-flex items-center gap-1 sm:flex"><Phone className="h-3.5 w-3.5" /> WhatsApp {COMPANY.whatsapp}</p>
            {COMPANY.email ? <p className="inline-flex items-center gap-1 sm:flex sm:justify-end"><Mail className="h-3.5 w-3.5" /> {COMPANY.email}</p> : null}
            {COMPANY.address ? <p className="inline-flex items-center gap-1 sm:flex sm:justify-end"><MapPin className="h-3.5 w-3.5" /> {COMPANY.address}</p> : null}
          </div>
        </header>

        <section className="grid border-b border-dashed border-slate-300 bg-[#f5fafb] sm:grid-cols-4">
          <SummaryField icon={FileText} label="Cobrança" value={chargeNumber ? chargeNumber.slice(-12).toUpperCase() : "Não informado"} />
          <SummaryField icon={CalendarDays} label="Vencimento" value={date(chargeDueDate)} />
          <SummaryField icon={ReceiptText} label="Valor" value={money(chargeAmount)} emphasis />
          <SummaryField icon={ShieldCheck} label="Status" value={displayedStatus} />
        </section>

        <section className="grid border-b border-dashed border-slate-300 lg:grid-cols-2">
          <DocumentSection title="Dados do cliente" icon={UserRound}>
            <Definition label="Nome" value={customer?.fullName || "Cliente DC NET"} />
            <Definition label="CPF/CNPJ" value="Não informado no portal" />
            <Definition label="Plano / contrato" value={planLabel} />
            <Definition label="Endereço" value={customerAddress(customer)} />
          </DocumentSection>
          <DocumentSection title="Dados da cobrança" icon={Building2} bordered>
            <Definition label="Referência / mês" value={invoice?.competence || "Não informado"} />
            <Definition label="Identificador" value={chargeNumber || "Não informado"} mono />
            <Definition label="Forma de pagamento" value="Exclusivamente via Pix" />
            <Definition label="Emissão" value={date(new Date().toISOString())} />
          </DocumentSection>
        </section>

        <section className="border-b border-dashed border-slate-300 p-5 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-50 text-[#087f75]"><ReceiptText className="h-5 w-5" /></span>
              <div><p className="text-xs font-semibold uppercase text-slate-500">Detalhamento</p><h2 className="text-base font-semibold">Demonstrativo da cobrança</h2></div>
            </div>
            <span className="hidden text-xs font-medium text-slate-400 sm:block">Documento digital DC NET</span>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-300">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead className="bg-[#071f36] text-left text-xs uppercase text-cyan-50">
                <tr><th className="p-3">Descrição</th><th className="p-3 text-center">Quantidade</th><th className="p-3 text-right">Valor unitário</th><th className="p-3 text-right">Valor total</th></tr>
              </thead>
              <tbody><tr className="border-t border-slate-300"><td className="p-3 font-medium">{description}</td><td className="p-3 text-center">1</td><td className="p-3 text-right">{money(chargeAmount)}</td><td className="p-3 text-right font-semibold">{money(chargeAmount)}</td></tr></tbody>
              <tfoot><tr className="border-t border-slate-300 bg-cyan-50/70"><td colSpan={3} className="p-3 text-right font-semibold">Total</td><td className="p-3 text-right text-base font-bold text-emerald-700">{money(chargeAmount)}</td></tr></tfoot>
            </table>
          </div>
        </section>

        <section className="grid gap-8 border-b border-dashed border-slate-300 bg-[#f7fbfc] p-5 sm:p-8 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-100 text-[#087f75]"><QrCode className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-slate-500">Escaneie para pagar</p><h2 className="text-base font-semibold">Pagamento via Pix</h2></div></div>
            {qrCode ? (
              <div className="qr-frame mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-lg border border-cyan-200 bg-white p-4 shadow-[0_18px_45px_-30px_rgba(8,127,117,0.7)] ring-4 ring-cyan-50">
                <Image src={qrCode} alt="QR Code Pix da cobrança" width={260} height={260} unoptimized className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex aspect-square w-full max-w-[280px] items-center justify-center rounded-lg border border-dashed border-cyan-300 bg-white p-6 text-center text-sm text-slate-500 ring-4 ring-cyan-50">QR Code indisponível</div>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase text-[#087f75]">Pix DC NET</p><h3 className="mt-1 text-2xl font-semibold text-slate-950">Pague com rapidez e segurança</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Abra o aplicativo do seu banco, escolha pagar via Pix e escaneie o QR Code. Você também pode copiar o código abaixo.</p>
            <div className="mt-5 min-h-24 rounded-md border border-slate-300 bg-white p-4 font-mono text-xs leading-5 break-all text-slate-700 shadow-inner">{pixCode || "Pix Copia e Cola indisponível."}</div>
            <Button onClick={copyPix} disabled={!pixCode} className="bolepix-copy mt-4 w-full bg-[#087f75] text-white shadow-md shadow-cyan-900/10 hover:bg-[#06675f] sm:w-fit">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Pix copiado" : "Copiar Pix"}
            </Button>
            <p className="mt-4 flex items-start gap-2 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm font-medium text-[#075e59]"><Wifi className="mt-0.5 h-4 w-4 shrink-0" /> Pague via Pix e tenha confirmação automática.</p>
          </div>
        </section>

        {(!qrCode || !pixCode) ? (
          <div className="border-b border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:px-8">
            <AlertTriangle className="mr-2 inline h-4 w-4" /> Não foi possível carregar o Pix desta fatura no momento.
          </div>
        ) : null}

        <footer className="p-5 sm:p-8">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#071f36] text-cyan-200"><Copy className="h-4 w-4" /></span><div><p className="text-xs font-bold uppercase text-[#087f75]">PIX COPIA E COLA</p><p className="text-sm text-slate-500">Use este código no aplicativo da sua instituição financeira.</p></div></div>
          <div className="mt-4 min-h-28 rounded-md border border-slate-300 bg-[#f4f8fa] p-4 font-mono text-xs leading-5 break-all text-slate-800 shadow-inner sm:p-5">{pixCode || "Código Pix indisponível."}</div>
          <div className="bolepix-copy mt-3"><Button variant="outline" onClick={copyPix} disabled={!pixCode}><Copy className="h-4 w-4" /> {copied ? "Pix copiado" : "Copiar código Pix"}</Button></div>
          <div className="mt-7 flex items-start gap-3 rounded-md border border-cyan-200 bg-[linear-gradient(90deg,#ecfeff_0%,#f0fdf4_100%)] p-4 text-sm font-semibold text-slate-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087f75]" />
            <span>
            Este documento não é boleto bancário. O pagamento é realizado exclusivamente via Pix.</span>
          </div>
          {error ? <p className="bolepix-copy mt-3 text-sm text-red-600">{error}</p> : null}
        </footer>
      </article>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .bolepix-page { background: #fff !important; padding: 0 !important; }
          .bolepix-actions, .bolepix-copy { display: none !important; }
          .bolepix-document { max-width: none !important; border: 1px solid #94a3b8 !important; border-radius: 0 !important; box-shadow: none !important; }
          .bolepix-header { background: linear-gradient(118deg,#061b34 0%,#063b4a 48%,#087f75 100%) !important; }
          .qr-frame { box-shadow: none !important; }
          section, footer { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}

function SummaryField({ icon: Icon, label, value, emphasis = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; emphasis?: boolean }) {
  return <div className="border-b border-dashed border-slate-300 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><Icon className="h-4 w-4 text-[#087f75]" />{label}</div><p className={`mt-2 break-words font-semibold ${emphasis ? "text-xl text-[#087f75]" : "text-sm text-slate-950"}`}>{value}</p></div>;
}

function DocumentSection({ title, icon: Icon, bordered = false, children }: { title: string; icon: React.ComponentType<{ className?: string }>; bordered?: boolean; children: React.ReactNode }) {
  return <div className={`p-5 sm:p-8 ${bordered ? "border-t border-dashed border-slate-300 lg:border-l lg:border-t-0" : ""}`}><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-50 text-[#087f75]"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-slate-500">Informações</p><h2 className="text-base font-semibold">{title}</h2></div></div><dl className="grid gap-3">{children}</dl></div>;
}

function Definition({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid gap-1 text-sm sm:grid-cols-[145px_1fr]"><dt className="text-slate-500">{label}</dt><dd className={`min-w-0 break-words font-medium text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>;
}
