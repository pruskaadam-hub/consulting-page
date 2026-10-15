import { useRef, useState } from "react";
import { db, money, priceMinor } from "./client";
import type { Invoice, Snapshot } from "./types";
import { PRICES, STUDENT_PRICES } from "../pricing.mjs";

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

export function InvoiceForm(
  { snapshot: s, busy, dueDate, today, onIssue, onClients }: {
    snapshot: Snapshot;
    busy: boolean;
    dueDate: string;
    today: string;
    onIssue: (issue: () => Promise<Invoice>) => void;
    onClients: () => void;
  },
) {
  const [mode, setMode] = useState("new");
  const [service, setService] = useState("individual");
  const [name, setName] = useState(services[0].name);
  const [details, setDetails] = useState(services[0].details);
  const [amount, setAmount] = useState(String(services[0].price));
  const requestId = useRef(crypto.randomUUID());
  const orders = s.orders.filter((o) =>
    !["cancelled", "refunded"].includes(o.status) &&
    o.source === "manual" && !o.is_test && !s.invoices.some((i) =>
      i.order_id === o.id
    )
  );
  function choose(id: string) {
    const selected = services.find((item) => item.id === id);
    setService(id);
    setName(selected?.name || "");
    setDetails(selected?.details || "");
    setAmount(selected ? String(selected.price) : "");
  }
  return (
    <form
      className="admin-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = Object.fromEntries(new FormData(form)) as Record<
          string,
          string
        >;
        const common = {
          p_tax_rate: Number(fields.tax_rate),
          p_due_date: fields.due_date,
          p_supply_date: fields.supply_date || null,
        };
        const rpc = mode === "new" ? "issue_service_invoice" : "issue_invoice";
        onIssue(async () => {
          const input = mode === "new"
            ? {
              ...common,
              p_request: requestId.current,
              p_client: fields.client_id,
              p_name: name,
              p_details: details,
              p_amount: priceMinor(amount),
            }
            : { ...common, p_order: fields.order_id };
          const result = await db!.rpc(rpc, input);
          if (result.error) {
            if (result.error.message.includes("Invoice request mismatch")) {
              throw new Error(
                "Tento pokus o vystavení už má jiné údaje. Obnov přehled faktur a ověř, zda faktura již vznikla.",
              );
            }
            throw new Error(
              "Fakturu nelze vystavit. Zkontroluj fakturační údaje a účet v Nastavení, adresu klienta, cenu, DPH a splatnost. Údaje formuláře zůstaly zachované.",
            );
          }
          requestId.current = crypto.randomUUID();
          form.reset();
          setMode("new");
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
            onChange={() => setMode("new")}
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
      {mode === "new"
        ? (
          <>
            <label className="admin-field">
              <span id="invoice-client_id-label">Klient pro fakturu</span>
              <select
                aria-labelledby="invoice-client_id-label"
                name="client_id"
                required
                defaultValue=""
                disabled={busy || !s.clients.length}
              >
                <option value="" disabled>Vyber klienta</option>
                {s.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            {!s.clients.length && (
              <p className="admin-small">
                Nejdřív založ klienta včetně fakturační adresy.{" "}
                <button
                  className="admin-text-button"
                  type="button"
                  onClick={onClients}
                >
                  Přejít na klienty
                </button>
              </p>
            )}
            <label className="admin-field">
              <span id="invoice-service-label">
                Konzultace nebo vlastní služba
              </span>
              <select
                aria-labelledby="invoice-service-label"
                name="service"
                value={service}
                onChange={(e) => choose(e.target.value)}
                disabled={busy}
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
              <span id="invoice-service_name-label">Název služby</span>
              <input
                type="text"
                aria-labelledby="invoice-service_name-label"
                name="service_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={300}
                required
                disabled={busy}
              />
            </label>
            <label className="admin-field">
              <span id="invoice-service_details-label">
                Podrobný popis služby
              </span>
              <textarea
                aria-labelledby="invoice-service_details-label"
                name="service_details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={5000}
                rows={4}
                disabled={busy}
              />
            </label>
            <label className="admin-field">
              <span id="invoice-service_amount-label">
                Celková cena služby v Kč
              </span>
              <input
                type="text"
                aria-labelledby="invoice-service_amount-label"
                name="service_amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
                disabled={busy}
              />
            </label>
            <p className="admin-small">
              Cena je konečná včetně případné DPH. Název a popis budou uvedené
              na faktuře. Objednávka se vytvoří spolu s fakturou.
            </p>
          </>
        )
        : (
          <>
            <label className="admin-field">
              <span id="invoice-order_id-label">Objednávka k fakturaci</span>
              <select
                aria-labelledby="invoice-order_id-label"
                name="order_id"
                required
                defaultValue=""
                disabled={busy || !orders.length}
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
      <label className="admin-field">
        <span id="invoice-due_date-label">Datum splatnosti</span>
        <input
          aria-labelledby="invoice-due_date-label"
          name="due_date"
          type="date"
          defaultValue={dueDate}
          min={today}
          required
          disabled={busy}
        />
      </label>
      <label className="admin-field">
        <span id="invoice-tax_rate-label">Sazba DPH</span>
        <select
          aria-labelledby="invoice-tax_rate-label"
          name="tax_rate"
          defaultValue="0"
          disabled={busy}
        >
          <option value="0">0 % / neplátce</option>
          {s.business.vat_registered && (
            <>
              <option value="12">12 %</option>
              <option value="21">21 %</option>
            </>
          )}
        </select>
      </label>
      <label className="admin-field">
        <span id="invoice-supply_date-label">Datum uskutečnění plnění</span>
        <input
          aria-labelledby="invoice-supply_date-label"
          name="supply_date"
          type="date"
          required={s.business.vat_registered === true}
          disabled={busy}
        />
      </label>
      <button
        className="button primary"
        type="submit"
        disabled={busy || (mode === "new" ? !s.clients.length : !orders.length)}
      >
        Vystavit fakturu
      </button>
    </form>
  );
}
