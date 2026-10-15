import { useRef, useState } from "react";
import { db, money, priceMinor } from "./client";
import type { Invoice, Snapshot } from "./types";
import { PRICES, STUDENT_PRICES } from "../pricing.mjs";
import {
  RecipientFields,
  recipientName,
  recipientOf,
  SupplierFields,
  supplierOf,
} from "./BillingFields";
import { InvoiceDocument } from "./InvoiceDocument";

const services = [
  {
    id: "individual",
    name: "Individuální konzultace",
    details: "Individuální konzultace v délce 50 minut.",
    price: PRICES.individual,
  },
  {
    id: "student",
    name: "Individuální konzultace pro studenty",
    details: "Individuální konzultace v délce 50 minut se studentskou cenou.",
    price: STUDENT_PRICES.individual,
  },
  {
    id: "package",
    name: "Série tří konzultací",
    details: "Balíček 3 konzultací po 50 minutách.",
    price: PRICES.package,
  },
  {
    id: "student-package",
    name: "Série tří konzultací pro studenty",
    details: "Balíček 3 konzultací po 50 minutách se studentskou cenou.",
    price: STUDENT_PRICES.package,
  },
];

export function InvoiceForm({ snapshot: s, busy, dueDate, today, onIssue }: {
  snapshot: Snapshot;
  busy: boolean;
  dueDate: string;
  today: string;
  onIssue: (issue: () => Promise<Invoice>) => void;
}) {
  const [mode, setMode] = useState("new");
  const [service, setService] = useState("individual");
  const [name, setName] = useState(services[0].name);
  const [details, setDetails] = useState(services[0].details);
  const [amount, setAmount] = useState(String(services[0].price));
  const [choice, setChoice] = useState(s.clients.length ? "" : "new");
  const [recipient, setRecipient] = useState(recipientOf());
  const [supplier, setSupplier] = useState(supplierOf(s.business));
  const [orderId, setOrderId] = useState("");
  const [due, setDue] = useState(dueDate);
  const [supply, setSupply] = useState(today);
  const [tax, setTax] = useState(s.business.vat_registered ? "21" : "0");
  const [taxNote, setTaxNote] = useState("");
  const [preview, setPreview] = useState(true);
  const [supplierOpen, setSupplierOpen] = useState(
    !s.business.legal_name || !s.business.registration,
  );
  const requestId = useRef(crypto.randomUUID());
  const orders = s.orders.filter((o) =>
    !["cancelled", "refunded"].includes(o.status) && o.source === "manual" &&
    !o.is_test && !s.invoices.some((i) => i.order_id === o.id)
  );
  const order = orders.find((o) => o.id === orderId);
  function choose(id: string) {
    const selected = services.find((item) => item.id === id);
    setService(id);
    setName(selected?.name || "");
    setDetails(selected?.details || "");
    setAmount(selected ? String(selected.price) : "");
  }
  function client(id: string) {
    setChoice(id);
    setRecipient(recipientOf(s.clients.find((c) => c.id === id)));
  }
  let total = 0;
  try {
    total = mode === "new" ? priceMinor(amount) : order?.amount_minor || 0;
  } catch { /* Incomplete prices remain editable in the draft. */ }
  const rate = supplier.vat_registered ? Number(tax) : 0;
  const net = Math.round(total / (1 + rate / 100));
  const draft: Invoice = {
    id: "draft",
    number: "NÁVRH",
    order_id: orderId,
    issue_date: today,
    due_date: due,
    supply_date: supply || null,
    supplier,
    recipient: {
      ...recipient,
      id: choice,
      name: recipientName(recipient),
      notes: "",
    },
    description: mode === "new" ? name : order?.description || "",
    service_details: mode === "new" ? details : order?.service_details || "",
    amount_minor: total,
    net_minor: net,
    tax_minor: total - net,
    tax_rate: rate,
    tax_note: supplier.vat_registered && rate === 0 ? taxNote : "",
  };
  return (
    <div className="invoice-editor-layout">
      <form
        className="admin-form-grid"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (!form.checkValidity()) {
            setSupplierOpen(true);
            requestAnimationFrame(() => form.reportValidity());
            return;
          }
          onIssue(async () => {
            const data = {
              order_id: mode === "order" ? orderId : null,
              client_id: choice === "new" ? null : choice,
              recipient: { ...recipient, name: recipientName(recipient) },
              supplier,
              name: mode === "new" ? name : order?.description,
              details: mode === "new" ? details : order?.service_details || "",
              amount_minor: mode === "new"
                ? priceMinor(amount)
                : order?.amount_minor,
              tax_rate: rate,
              tax_note: supplier.vat_registered && rate === 0 ? taxNote : "",
              due_date: due,
              supply_date: supply || null,
            };
            const result = await db!.rpc("issue_invoice_draft", {
              p_request: requestId.current,
              p_data: data,
            });
            if (result.error) {
              if (result.error.message.includes("Invoice request mismatch")) {
                throw new Error(
                  "Tento pokus o vystavení už má jiné údaje. Obnov přehled a ověř, zda faktura již vznikla.",
                );
              }
              if (result.error.code === "23505") {
                throw new Error(
                  "Klient s tímto e-mailem už existuje. Vyber ho ze seznamu a zkontroluj jeho údaje.",
                );
              }
              throw new Error(
                "Fakturu nelze vystavit. Zkontroluj firemní údaje včetně zápisu v rejstříku, adresu a zemi klienta, IČO, DIČ, cenu a splatnost. Údaje formuláře zůstaly zachované.",
              );
            }
            requestId.current = crypto.randomUUID();
            setMode("new");
            setOrderId("");
            setChoice("new");
            setRecipient(recipientOf());
            choose("individual");
            return result.data as Invoice;
          });
        }}
      >
        <fieldset className="admin-invoice-modes" disabled={busy}>
          <legend>Podklad faktury</legend>
          <label>
            <input
              type="radio"
              name="invoice_mode"
              value="new"
              checked={mode === "new"}
              onChange={() => {
                setMode("new");
                setOrderId("");
              }}
            />{" "}
            Nová konzultace nebo služba
          </label>
          <label>
            <input
              type="radio"
              name="invoice_mode"
              value="order"
              checked={mode === "order"}
              onChange={() => setMode("order")}
            />{" "}
            Existující objednávka
          </label>
        </fieldset>
        {mode === "order" && (
          <>
            <label className="admin-field">
              <span>Objednávka k fakturaci</span>
              <select
                aria-label="Objednávka k fakturaci"
                name="order_id"
                value={orderId}
                required
                disabled={busy || !orders.length}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  const selected = orders.find((o) => o.id === e.target.value);
                  if (selected) client(selected.client_id);
                }}
              >
                <option value="" disabled>Vyber objednávku</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.clients?.name} · {o.description} ·{" "}
                    {money(o.amount_minor)}
                  </option>
                ))}
              </select>
            </label>
            {!orders.length && (
              <p className="admin-small">
                Mezi posledními 100 objednávkami není žádná k vystavení nové
                faktury. Zvol „Nová konzultace nebo služba“. Již vystavené
                doklady najdeš v přehledu faktur.
              </p>
            )}
          </>
        )}
        <fieldset className="invoice-editor-section" disabled={busy}>
          <legend>Odběratel a kontaktní údaje</legend>
          {mode === "new" && (
            <label className="admin-field">
              <span>Klient pro fakturu</span>
              <select
                aria-label="Klient pro fakturu"
                name="client_id"
                value={choice}
                onChange={(e) => client(e.target.value)}
                required
              >
                <option value="" disabled>Vyber klienta</option>
                <option value="new">Ručně zadat nového klienta</option>
                {s.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          {(choice && (mode === "new" || order)) && (
            <>
              <RecipientFields value={recipient} onChange={setRecipient} />
              <p className="admin-small">
                {choice === "new"
                  ? "Nový klient se uloží do Klientů společně s vystavením faktury."
                  : "Upravené údaje se při vystavení uloží také do kontaktu klienta."}
              </p>
            </>
          )}
        </fieldset>
        {mode === "new" && (
          <fieldset className="invoice-editor-section" disabled={busy}>
            <legend>Služba a cena</legend>
            <label className="admin-field">
              <span>Konzultace nebo vlastní služba</span>
              <select
                aria-label="Konzultace nebo vlastní služba"
                name="service"
                value={service}
                onChange={(e) =>
                  choose(e.target.value)}
              >
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {money(item.price * 100)}
                  </option>
                ))}
                <option value="custom">Vlastní služba</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Název služby</span>
              <input
                aria-label="Název služby"
                type="text"
                name="service_name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)}
                maxLength={300}
                required
              />
            </label>
            <label className="admin-field">
              <span>Podrobný popis služby</span>
              <textarea
                aria-label="Podrobný popis služby"
                name="service_details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={5000}
                rows={4}
              />
            </label>
            <label className="admin-field">
              <span>Celková cena služby v Kč</span>
              <input
                aria-label="Celková cena služby v Kč"
                type="text"
                name="service_amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
              />
            </label>
            <p className="admin-small">
              Konečná cena včetně případné daně. Objednávka vznikne současně s
              fakturou.
            </p>
          </fieldset>
        )}
        <details
          className="invoice-supplier-editor"
          open={supplierOpen}
          onToggle={(e) => setSupplierOpen(e.currentTarget.open)}
        >
          <summary>Údaje mé firmy a vzhled faktury</summary>
          <fieldset className="invoice-editor-section" disabled={busy}>
            <legend>Dodavatel</legend>
            <SupplierFields
              value={supplier}
              onChange={(b) => {
                setSupplier(b);
                if (!b.vat_registered) setTax("0");
                else if (!supplier.vat_registered) setTax("21");
              }}
            />
          </fieldset>
        </details>
        <fieldset className="invoice-editor-section" disabled={busy}>
          <legend>Termíny a zdanění</legend>
          <label className="admin-field">
            <span>Datum splatnosti</span>
            <input
              aria-label="Datum splatnosti"
              name="due_date"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              min={today}
              required
            />
          </label>
          {supplier.vat_registered && (
            <label className="admin-field">
              <span>Sazba DPH</span>
              <select
                aria-label="Sazba DPH"
                name="tax_rate"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              >
                <option value="0">0 % / zvláštní režim</option>
                <option value="12">12 %</option>
                <option value="21">21 %</option>
              </select>
            </label>
          )}
          {supplier.vat_registered && rate === 0 && (
            <label className="admin-field">
              <span>Důvod nulové DPH a právní ustanovení</span>
              <textarea
                aria-label="Důvod nulové DPH a právní ustanovení"
                value={taxNote}
                onChange={(e) => setTaxNote(e.target.value)}
                required
                maxLength={1000}
              />
            </label>
          )}
          <label className="admin-field">
            <span>
              {supplier.vat_registered
                ? "Datum plnění / přijetí platby"
                : "Datum poskytnutí služby"}
            </span>
            <input
              aria-label={supplier.vat_registered
                ? "Datum plnění / přijetí platby"
                : "Datum poskytnutí služby"}
              name="supply_date"
              type="date"
              value={supply}
              onChange={(e) => setSupply(e.target.value)}
              required={supplier.vat_registered === true}
            />
          </label>
          {supplier.vat_registered && (
            <p className="admin-small">
              Použij dřívější datum z poskytnutí služby a přijetí platby. Sazbu
              a případné zvláštní zdanění ověř podle konkrétního plnění.
            </p>
          )}
        </fieldset>
        <p className="admin-small">
          Změny klienta a firemních údajů se uloží při vystavení. Náhled je
          návrh. Vystavený doklad zachová tehdejší údaje.
        </p>
        <button
          className="button primary"
          type="submit"
          disabled={busy || (mode === "new" ? !choice : !order)}
        >
          Vystavit fakturu
        </button>
      </form>
      <aside
        className="invoice-editor-preview"
        aria-label="Upravitelný náhled faktury"
      >
        <button
          className="admin-outline"
          type="button"
          aria-expanded={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Skrýt náhled" : "Zobrazit náhled"}
        </button>
        <p className="admin-small">
          Uprav pole ve formuláři. Náhled se aktualizuje průběžně.
        </p>
        {preview && <InvoiceDocument invoice={draft} draft />}
      </aside>
    </div>
  );
}
