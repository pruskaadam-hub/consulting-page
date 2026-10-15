export type Client = {
  id: string;
  name: string;
  email: string;
  address: string;
  ico: string;
  vat_id: string;
  notes: string;
};
export type Order = {
  id: string;
  client_id: string;
  description: string;
  service_details: string;
  amount_minor: number;
  status: string;
  source: string;
  is_test: boolean;
  created_at: string;
  clients: { name: string; email: string };
};
export type Booking = {
  uid: string;
  name: string;
  email: string;
  title: string;
  starts_at: string;
  status: string;
};
export type Business = {
  legal_name: string;
  ico: string;
  address: string;
  bank_account: string;
  vat_registered: boolean | null;
  vat_id: string;
  invoice_note: string;
};
export type Invoice = {
  id: string;
  orders?: { status: string };
  number: string;
  order_id: string;
  issue_date: string;
  due_date: string;
  supply_date: string | null;
  supplier: Business;
  recipient: Client;
  description: string;
  service_details: string;
  amount_minor: number;
  net_minor: number;
  tax_minor: number;
  tax_rate: number;
};
export type Task = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
};
export type Outbox = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  created_at: string;
};
export type StripeInvoice = {
  id: string;
  is_test: boolean;
  number: string;
  status: string;
  amount_minor: number;
  tax_minor: number | null;
  hosted_url: string | null;
  pdf_url: string | null;
};
export type Integrations = {
  payment_mode: "offline" | "stripe";
  mail: boolean;
  mail_read?: boolean;
  mail_send?: boolean;
  mail_provider?: "icloud" | "forpsi";
  analytics: boolean;
  payments: boolean;
  invoicing: boolean;
  tax: boolean;
  stripe_mode: string;
  bookings: boolean;
  events: boolean;
  mailbox: string;
};
export type Snapshot = {
  clients: Client[];
  orders: Order[];
  bookings: Booking[];
  invoices: Invoice[];
  stripeInvoices: StripeInvoice[];
  tasks: Task[];
  outbox: Outbox[];
  business: Business;
  summary: {
    revenue: number;
    month_revenue: number;
    pending: number;
    clients: number;
    bookings: number;
  };
};
export type Message = {
  uid: number;
  subject: string;
  from: string;
  date: string;
  text?: string;
  attachments?: { name: string; mime: string }[];
};
