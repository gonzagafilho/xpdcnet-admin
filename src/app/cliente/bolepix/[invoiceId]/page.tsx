"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Printer,
  QrCode,
  ShieldCheck,
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
  cnpj: process.env.NEXT_PUBLIC_DCNET_CNPJ || "Não informado",
  whatsapp: process.env.NEXT_PUBLIC_DCNET_WHATSAPP || "(61) 99662-7145",
  email: process.env.NEXT_PUBLIC_DCNET_EMAIL || "Atendimento DC NET",
  address: process.env.NEXT_PUBLIC_DCNET_ADDRESS || "Planaltina - DF",
  site: process.env.NEXT_PUBLIC_DCNET_SITE || "dcinfinity.net.br",
  support: process.env.NEXT_PUBLIC_DCNET_SUPPORT || "Suporte pelo Portal do Cliente",
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
  const description = invoice?.description || "Mensalidade DC NET TESTE BOLEPIX";
  const chargeNumber = pix?.providerChargeId || invoice?._id || invoiceId || "";
  const chargeAmount = Number(pix?.amount ?? invoice?.amount ?? 0);
  const chargeDueDate = pix?.dueDate || invoice?.dueDate;
  const customer = dashboard?.client;


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

      <article className="bolepix-document mx-auto max-w-[900px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-[0_24px_70px_-42px_rgba(2,6,23,0.55)]">
        <header className="bolepix-brand-bar flex min-h-14 items-center justify-between gap-3 bg-[linear-gradient(105deg,#061b34_0%,#063b4a_60%,#087f75_100%)] px-3 py-2 text-white sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/30 bg-white p-0.5">
              <Image src="/icons/dcnet-client.svg" alt="DC NET" width={36} height={36} priority className="h-full w-full rounded-sm" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-bold leading-tight text-white sm:text-base">BolePix DC NET</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-100/40 bg-white/10 px-2 py-0.5 text-[8px] font-bold uppercase text-cyan-50">
                  <ShieldCheck className="h-2.5 w-2.5" /> Pagamento via Pix
                </span>
              </div>
              <p className="mt-0.5 text-[8px] font-semibold uppercase text-cyan-200">DC NET Telecom</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[8px] font-semibold uppercase text-cyan-200">WhatsApp DC NET</p>
            <p className="mt-0.5 text-[10px] font-bold text-white sm:text-xs">{COMPANY.whatsapp}</p>
          </div>
        </header>

        <section className="border-b border-slate-300 bg-white">
          <div className="grid lg:grid-cols-[1fr_1.35fr]">
            <div className="border-b border-slate-300 px-3 py-2.5 lg:border-b-0 lg:border-r">
              <p className="text-[9px] font-bold uppercase text-slate-700">Dados do cliente</p>
              <p className="mt-1.5 truncate text-xs font-bold uppercase text-slate-900">{customer?.fullName || "Cliente DC NET"}</p>
              <p className="mt-1 text-[10px] text-slate-600"><strong className="font-bold text-slate-700">CPF/CNPJ:</strong> Não informado no portal</p>
            </div>

            <div className="grid grid-cols-3">
              <FinancialBox label="Cobrança" value={chargeNumber ? chargeNumber.slice(-12).toUpperCase() : "Não informado"} />
              <FinancialBox label="Vencimento" value={date(chargeDueDate)} />
              <FinancialBox label="Valor" value={money(chargeAmount)} emphasis />
            </div>
          </div>

          <div className="border-t border-slate-300 px-3 py-1.5">
            <p className="text-[9px] font-bold uppercase text-slate-700">Observação</p>
          </div>
          <div className="border-t border-slate-300 bg-slate-100 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase text-slate-800">Obrigado pela preferência!!!!</p>
          </div>
          <div className="border-t border-slate-300 px-3 py-1.5">
            <p className="text-[9px] font-bold uppercase text-slate-700">Demonstrativo</p>
          </div>

          <div className="overflow-x-auto border-t border-slate-300">
            <table className="w-full min-w-[540px] border-collapse text-[10px]">
              <thead className="bg-slate-100 text-left text-[8px] font-bold uppercase text-slate-700">
                <tr>
                  <th className="border-r border-slate-300 px-2.5 py-1.5">Descrição</th>
                  <th className="border-r border-slate-300 px-2.5 py-1.5 text-right">Preço unit</th>
                  <th className="border-r border-slate-300 px-2.5 py-1.5 text-center">Qtde</th>
                  <th className="px-2.5 py-1.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-300">
                  <td className="border-r border-slate-300 px-2.5 py-2 font-medium uppercase">{description}</td>
                  <td className="border-r border-slate-300 px-2.5 py-2 text-right">{money(chargeAmount)}</td>
                  <td className="border-r border-slate-300 px-2.5 py-2 text-center">1</td>
                  <td className="px-2.5 py-2 text-right font-semibold">{money(chargeAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="pix-focus border-b border-dashed border-slate-300 bg-[#f6fafb] px-5 py-5 sm:px-6">
          <div className="mb-4 flex items-center justify-between border-b border-cyan-200 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-[#087f75]">Forma de pagamento</p>
              <h2 className="mt-0.5 text-lg font-bold text-[#071f36]">PAGAMENTO VIA PIX</h2>
            </div>
            <QrCode className="h-7 w-7 text-[#087f75]" />
          </div>

          <div className="grid items-center gap-5 lg:grid-cols-[220px_1fr]">
            <div className="mx-auto w-full max-w-[220px]">
              {qrCode ? (
                <div className="qr-frame flex aspect-square items-center justify-center rounded-md border border-cyan-200 bg-white p-3 shadow-[0_14px_38px_-28px_rgba(8,127,117,0.8)] ring-4 ring-cyan-50">
                  <Image src={qrCode} alt="QR Code Pix da cobrança" width={200} height={200} unoptimized className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-cyan-300 bg-white p-5 text-center text-xs text-slate-500">QR Code indisponível</div>
              )}
              <p className="mt-2 text-center text-[10px] font-medium text-slate-500">Escaneie com o aplicativo da sua instituição financeira</p>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-slate-700">Pix Copia e Cola</p>
              <div className="mt-2 min-h-24 rounded border border-slate-300 bg-white p-3 font-mono text-[11px] leading-4 break-all text-slate-700 shadow-inner">{pixCode || "Pix Copia e Cola indisponível."}</div>
              <Button onClick={copyPix} disabled={!pixCode} className="bolepix-copy mt-3 w-full bg-[#087f75] text-white shadow-sm hover:bg-[#06675f] sm:w-fit">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Pix copiado" : "Copiar PIX"}
              </Button>
              <p className="mt-3 flex items-start gap-2 text-xs font-medium text-[#075e59]"><Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Após a confirmação do PIX a baixa ocorre automaticamente.</p>
            </div>
          </div>
        </section>

        {(!qrCode || !pixCode) ? (
          <div className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-xs text-amber-900 sm:px-6">
            <AlertTriangle className="mr-2 inline h-3.5 w-3.5" /> Não foi possível carregar o Pix desta fatura no momento.
          </div>
        ) : null}

        <footer className="px-5 py-4 sm:px-6">
          <div className="grid gap-3 text-[11px] sm:grid-cols-[1.2fr_1fr_1fr]">
            <div><p className="font-bold uppercase text-[#071f36]">DC NET TELECOM</p><p className="mt-1 text-slate-500">Conectividade e atendimento para você.</p></div>
            <div className="space-y-0.5 text-slate-600"><p><strong>CNPJ:</strong> {COMPANY.cnpj}</p><p><strong>WhatsApp:</strong> {COMPANY.whatsapp}</p><p><strong>Site:</strong> {COMPANY.site}</p></div>
            <div className="space-y-0.5 text-slate-600"><p><strong>Suporte:</strong> {COMPANY.support}</p><p><strong>Contato:</strong> {COMPANY.email}</p><p><strong>Endereço:</strong> {COMPANY.address}</p></div>
          </div>
          <div className="mt-4 flex items-start gap-2 border-t border-slate-200 pt-3 text-xs font-semibold text-slate-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#087f75]" />
            <span>Este documento não é boleto bancário. O pagamento é realizado exclusivamente via Pix.</span>
          </div>
          {error ? <p className="bolepix-copy mt-2 text-xs text-red-600">{error}</p> : null}
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
          .bolepix-brand-bar { background: linear-gradient(105deg,#061b34 0%,#063b4a 60%,#087f75 100%) !important; }
          .qr-frame { box-shadow: none !important; }
          section, footer { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}

function FinancialBox({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="flex min-h-[58px] flex-col justify-center border-r border-slate-300 px-2 py-1.5 text-center last:border-r-0"><p className="text-[8px] font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 break-words font-bold leading-tight ${emphasis ? "text-base text-[#087f75]" : "text-[11px] text-slate-900"}`}>{value}</p></div>;
}
