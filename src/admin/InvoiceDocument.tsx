import type { CSSProperties } from "react";
import type { Invoice } from "./types";
import { money } from "./client";
import { assetUrl } from "../routes";

const amount = (minor: number) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague" }).format(
      new Date(`${value.slice(0, 10)}T12:00:00Z`),
    )
    : "Doplň datum";
export function InvoiceDocument(
  { invoice: i, draft = false }: { invoice: Invoice; draft?: boolean },
) {
  const b = i.supplier;
  const c = i.recipient;
  const country = c.country_code
    ? new Intl.DisplayNames(["cs"], { type: "region" }).of(c.country_code)
    : "";
  return (
    <section
      className={`admin-invoice ${draft ? "admin-invoice-draft" : ""}`}
      style={{
        "--invoice-accent": b.accent_color || "#d7202b",
      } as CSSProperties}
      aria-label={draft ? "Náhled faktury" : `Faktura ${i.number}`}
    >
      <div className="admin-invoice-header">
        <div className="invoice-brand">
          {b.logo_style === "original"
            ? (
              <img
                className="invoice-original-logo"
                src={assetUrl("logo.jpg")}
                alt={b.brand_name || "Adam Pruška"}
                width="100"
                height="116"
              />
            )
            : b.logo_style !== "none" && (
              <span className="invoice-brand-mark" aria-hidden="true">ap.</span>
            )}
          <div>
            <strong>{b.brand_name || b.legal_name || "Adam Pruška"}</strong>
            <span>Mentoring & Consulting</span>
          </div>
        </div>
        <div className="invoice-title">
          <h2>Faktura {i.number}</h2>
          <span>
            {draft
              ? "NÁVRH · dosud nevystaveno"
              : b.vat_registered
              ? "Daňový doklad"
              : "Faktura"}
          </span>
          {!draft && (
            <button
              className="admin-outline"
              type="button"
              onClick={() => window.print()}
            >
              Tisk / uložit PDF
            </button>
          )}
        </div>
      </div>
      {draft && (
        <p className="invoice-draft-note">
          Živý náhled. Číslo dokladu přidělí systém až při vystavení.
        </p>
      )}
      <div className="invoice-parties">
        <div>
          <h3>Dodavatel</h3>
          <strong>{b.legal_name || "Doplň obchodní jméno"}</strong>
          <p className="invoice-address">{b.address || "Doplň sídlo"}</p>
          <p>
            IČO: {b.ico || "Doplň IČO"}
            {b.vat_id && (
              <>
                <br />DIČ: {b.vat_id}
              </>
            )}
          </p>
          <p className="invoice-registration">
            {b.registration ||
              (draft ? "Doplň údaj o zápisu v rejstříku nebo evidenci." : "")}
          </p>
          {(b.contact_email || b.contact_phone || b.website) && (
            <p className="invoice-contact">
              {[b.contact_email, b.contact_phone, b.website].filter(Boolean)
                .map((value) => <span key={value}>{value}</span>)}
            </p>
          )}
        </div>
        <div>
          <h3>Odběratel</h3>
          <strong>{c.name || "Doplň odběratele"}</strong>
          {c.company_name && (c.first_name || c.last_name) && (
            <p>
              Kontaktní osoba:{" "}
              {[c.first_name, c.last_name].filter(Boolean).join(" ")}
            </p>
          )}
          <p className="invoice-address">
            {c.address || "Doplň fakturační adresu"}
            {country && (
              <>
                <br />
                {country}
              </>
            )}
          </p>
          {(c.ico || c.vat_id) && (
            <p>
              {c.ico && <>IČO / identifikátor: {c.ico}</>}
              {c.vat_id && (
                <>
                  <br />DIČ: {c.vat_id}
                </>
              )}
            </p>
          )}
          {(c.email || c.website) && (
            <p className="invoice-contact">
              {c.email && <span>{c.email}</span>}
              {c.website && <span>{c.website}</span>}
            </p>
          )}
        </div>
      </div>
      <dl className="invoice-dates">
        <div>
          <dt>Vystaveno</dt>
          <dd>{date(i.issue_date)}</dd>
        </div>
        <div>
          <dt>Splatnost</dt>
          <dd>{date(i.due_date)}</dd>
        </div>
        {i.supply_date && (
          <div>
            <dt>
              {b.vat_registered
                ? "Plnění / přijetí platby"
                : "Poskytnutí služby"}
            </dt>
            <dd>{date(i.supply_date)}</dd>
          </div>
        )}
      </dl>
      <div className="invoice-item">
        <div>
          <h3>{i.description || "Název služby"}</h3>
          {i.service_details && (
            <p className="admin-service-details">{i.service_details}</p>
          )}
          <small>Množství: 1 služba</small>
        </div>
        <strong>{amount(i.amount_minor)}</strong>
      </div>
      <div className="invoice-payment-total">
        <div className="invoice-payment">
          <h3>Platba převodem</h3>
          <p>
            Účet / IBAN:{" "}
            <strong>{b.bank_account || "Doplň bankovní účet"}</strong>
          </p>
          <p>
            Variabilní symbol:{" "}
            <strong>{draft ? "přidělí se při vystavení" : i.number}</strong>
          </p>
        </div>
        <div className="invoice-totals">
          {b.vat_registered
            ? (
              <>
                <p>
                  <span>Základ daně</span>
                  <strong>{amount(i.net_minor)}</strong>
                </p>
                <p>
                  <span>DPH {i.tax_rate} %</span>
                  <strong>{amount(i.tax_minor)}</strong>
                </p>
              </>
            )
            : (
              <p>
                {b.vat_registered === null
                  ? "Doplň stav plátcovství."
                  : "Dodavatel není plátcem DPH."}
              </p>
            )}
          <div className="invoice-total">
            <span>Celkem k úhradě</span>
            <strong>{money(i.amount_minor)}</strong>
          </div>
        </div>
      </div>
      {i.tax_note && <p className="invoice-footer-note">{i.tax_note}</p>}
      {b.invoice_note && <p className="invoice-footer-note">{b.invoice_note}
      </p>}
      <p className="admin-small">
        Stav úhrady je vedený u objednávky. Tento doklad sám o sobě nepotvrzuje
        zaplacení.
      </p>
    </section>
  );
}
