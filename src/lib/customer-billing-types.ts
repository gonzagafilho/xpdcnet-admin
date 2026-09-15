export type InvoiceItem = {
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