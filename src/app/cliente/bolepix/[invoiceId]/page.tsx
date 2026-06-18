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

type BolepixAd = {
  _id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type BolepixAdResponse = { ad: BolepixAd | null };

type CustomerDashboard = {
  client: {
    _id: string;
    fullName: string;
    email?: string;
    phone?: string;
    status: string;
    document?: string;
    address?: {
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zip?: string;
      cep?: string;
      reference?: string;
    };
  };
  plan: {
    _id: string;
    name: string;
    speedMbps: number;
  } | null;
};

const COMPANY = {
  cnpj: "63.899.571/0001-20",
  whatsapp: "(61) 99662-7145",
  email: process.env.NEXT_PUBLIC_DCNET_EMAIL || "Atendimento DC NET",
  address: "Planaltina - DF",
  site: "https://dcinfinity.net.br",
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

function formatPostalCode(value?: string) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
  return value;
}

function formatCustomerAddress(address?: { street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zip?: string; cep?: string }) {
  if (!address) return undefined;
  const street = address.street?.trim();
  const number = address.number?.trim();
  const neighborhood = address.neighborhood?.trim();
  const city = address.city?.trim();
  const state = address.state?.trim();
  const addressParts: string[] = [];

  const streetLine = [street, number].filter(Boolean).join(street && number ? ", " : "");
  if (streetLine) addressParts.push(streetLine);
  if (neighborhood) addressParts.push(neighborhood);
  const cityState = [city, state].filter(Boolean).join("/");
  if (cityState) addressParts.push(cityState);

  const formatted = addressParts.filter(Boolean).join(", ");
  return formatted || undefined;
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
  const [bolepixAd, setBolepixAd] = useState<BolepixAd | null>(null);
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
      const [paymentData, dashboardData, adData] = await Promise.all([
        customerApiFetch<PaymentResponse>(`/customer-app/invoices/${invoiceId}/payment`),
        customerApiFetch<CustomerDashboard>("/customer-app/me"),
        customerApiFetch<BolepixAdResponse>("/customer-app/bolepix-ad").catch(() => ({ ad: null })),
      ]);
      setPayment(paymentData);
      setDashboard(dashboardData);
      setBolepixAd(adData.ad);
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
              <p className="mt-0.5 text-[8px] font-semibold uppercase text-cyan-200">DCNET INFINITY</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[8px] font-semibold uppercase text-cyan-200">WhatsApp DC NET</p>
            <p className="mt-0.5 text-[10px] font-bold text-white sm:text-xs">{COMPANY.whatsapp}</p>
          </div>
        </header>

        <section className="border-b border-slate-300 bg-white">
          <div className="border-b border-slate-300 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase text-slate-700">Cedente / Empresa Emissora</p>
            <p className="mt-1.5 truncate text-xs font-bold uppercase text-slate-900">DCNET INFINITY</p>
            <p className="mt-1 text-[10px] text-slate-600"><strong className="font-bold text-slate-700">CNPJ:</strong> 63.899.571/0001-20</p>
            <p className="mt-1 text-[10px] text-slate-600"><strong className="font-bold text-slate-700">Site:</strong> https://dcinfinity.net.br</p>
            <p className="mt-1 text-[10px] text-slate-600"><strong className="font-bold text-slate-700">WhatsApp:</strong> (61) 99662-7145</p>
          </div>
          <div className="grid lg:grid-cols-[1fr_1.35fr]">
            <div className="border-b border-slate-300 px-3 py-2.5 lg:border-b-0 lg:border-r">
              <p className="text-[9px] font-bold uppercase text-slate-700">Sacado / Dados do cliente</p>
              <p className="mt-1.5 truncate text-xs font-bold uppercase text-slate-900">{customer?.fullName || "Cliente DC NET"}</p>
              <div className="mt-1 grid gap-0.5 text-[10px] leading-tight text-slate-600">
                <p><strong className="font-bold text-slate-700">CPF/CNPJ:</strong> {customer?.document || "Não informado no portal"}</p>
                <p><strong className="font-bold text-slate-700">Endereço:</strong> {formatCustomerAddress(customer?.address) || "Não informado no portal"}</p>
                <p><strong className="font-bold text-slate-700">CEP:</strong> {formatPostalCode(customer?.address?.zip || customer?.address?.cep) || "Não informado no portal"}</p>
                <p><strong className="font-bold text-slate-700">Plano/Contrato:</strong> {dashboard?.plan?.name || "Não informado no portal"}</p>
              </div>
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
          {bolepixAd ? (
            <div className="bolepix-ad border-t border-slate-300 bg-white px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bolepixAd.imageUrl}
                alt={bolepixAd.title || "Banner promocional"}
                className="mx-auto max-h-40 w-full object-contain"
              />
            </div>
          ) : null}
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
            <div><p className="font-bold uppercase text-[#071f36]">DCNET INFINITY</p><p className="mt-1 text-slate-500">Conectividade e atendimento para você.</p></div>
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
          @page { size: A4 portrait; margin: 7mm; }
          html, body { width: 100% !important; min-height: 0 !important; background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .bolepix-page { background: #fff !important; padding: 0 !important; }
          .bolepix-actions, .bolepix-copy, .bolepix-document button { display: none !important; }
          .bolepix-document {
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .bolepix-brand-bar {
            min-height: 0 !important;
            padding: 6px 10px !important;
            background: linear-gradient(105deg,#061b34 0%,#063b4a 60%,#087f75 100%) !important;
          }
          .bolepix-document > section:first-of-type > .border-b {
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }
          .bolepix-document > section:first-of-type > .grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) !important;
          }
          .bolepix-document > section:first-of-type > .grid > div:first-child {
            border-right: 1px solid #cbd5e1 !important;
            border-bottom: 0 !important;
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }
          .bolepix-document table { min-width: 0 !important; }
          .bolepix-document th,
          .bolepix-document td {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          .bolepix-ad {
            padding: 4px 8px !important;
            break-inside: avoid !important;
          }
          .bolepix-ad img {
            display: block !important;
            width: 100% !important;
            max-height: 72px !important;
            object-fit: contain !important;
          }
          .pix-focus { padding: 8px 12px !important; }
          .pix-focus > div:first-child {
            margin-bottom: 7px !important;
            padding-bottom: 5px !important;
          }
          .pix-focus > div:first-child h2 {
            margin-top: 0 !important;
            font-size: 15px !important;
            line-height: 18px !important;
          }
          .pix-focus > .grid {
            grid-template-columns: 160px minmax(0, 1fr) !important;
            gap: 12px !important;
          }
          .pix-focus > .grid > div:first-child { max-width: 150px !important; }
          .qr-frame {
            width: 150px !important;
            height: 150px !important;
            padding: 5px !important;
            box-shadow: none !important;
            --tw-ring-offset-shadow: 0 0 #0000 !important;
            --tw-ring-shadow: 0 0 #0000 !important;
          }
          .qr-frame + p {
            margin-top: 4px !important;
            font-size: 8px !important;
            line-height: 10px !important;
          }
          .pix-focus > .grid > div:last-child > p:first-child { font-size: 10px !important; }
          .pix-focus > .grid > div:last-child > div {
            min-height: 0 !important;
            margin-top: 4px !important;
            padding: 6px !important;
            font-size: 9px !important;
            line-height: 12px !important;
          }
          .pix-focus > .grid > div:last-child > p:last-child {
            margin-top: 6px !important;
            font-size: 9px !important;
            line-height: 12px !important;
          }
          .bolepix-document > footer { padding: 8px 12px !important; }
          .bolepix-document > footer > .grid {
            grid-template-columns: 1.2fr 1fr 1fr !important;
            gap: 8px !important;
            font-size: 9px !important;
            line-height: 12px !important;
          }
          .bolepix-document > footer > div:last-of-type {
            margin-top: 7px !important;
            padding-top: 6px !important;
            font-size: 9px !important;
            line-height: 12px !important;
          }
          section, footer { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}

function FinancialBox({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="flex min-h-[58px] flex-col justify-center border-r border-slate-300 px-2 py-1.5 text-center last:border-r-0"><p className="text-[8px] font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 break-words font-bold leading-tight ${emphasis ? "text-base text-[#087f75]" : "text-[11px] text-slate-900"}`}>{value}</p></div>;
}
