import type { Business, Client } from "./types";

export type Recipient = Required<
  Pick<
    Client,
    | "name"
    | "email"
    | "address"
    | "ico"
    | "vat_id"
    | "first_name"
    | "last_name"
    | "company_name"
    | "client_type"
    | "website"
    | "country_code"
    | "vat_registered"
  >
>;
export function recipientOf(c?: Client): Recipient {
  const parts = (c?.name || "").trim().split(/\s+/);
  return {
    name: c?.name || "",
    email: c?.email || "",
    address: c?.address || "",
    ico: c?.ico || "",
    vat_id: c?.vat_id || "",
    first_name: c?.first_name ||
      (!c?.company_name && !c?.ico ? parts[0] : "") || "",
    last_name: c?.last_name ||
      (!c?.company_name && !c?.ico ? parts.slice(1).join(" ") : ""),
    company_name: c?.company_name || (c?.ico ? c.name : ""),
    client_type: c?.company_name || c?.ico
      ? "company"
      : c?.client_type || "person",
    website: c?.website || "",
    country_code: c ? c.country_code || "" : "CZ",
    vat_registered: c?.vat_registered ?? Boolean(c?.vat_id),
  };
}
export const recipientName = (c: Recipient) =>
  c.client_type === "company"
    ? c.company_name.trim()
    : `${c.first_name.trim()} ${c.last_name.trim()}`.trim();
export function supplierOf(b: Business): Business {
  return {
    ...b,
    registration: b.registration || "",
    brand_name: b.brand_name ?? "Adam Pruška",
    contact_email: b.contact_email || "",
    contact_phone: b.contact_phone || "",
    website: b.website ?? "https://adampruska.cz",
    logo_style: b.logo_style || "site",
    accent_color: b.accent_color || "#d7202b",
  };
}
const display = new Intl.DisplayNames(["cs"], {
  type: "region",
  fallback: "none",
});
const countries = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].flatMap((a) =>
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((b) => a + b)
)
  .map((code) => ({ code, name: display.of(code) })).filter((item) => item.name)
  .sort((a, b) => a.name!.localeCompare(b.name!, "cs"));
function Text(
  {
    label,
    value,
    change,
    required = false,
    type = "text",
    max = 300,
    area = false,
    pattern,
  }: {
    label: string;
    value: string;
    change: (value: string) => void;
    required?: boolean;
    type?: string;
    max?: number;
    area?: boolean;
    pattern?: string;
  },
) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {area
        ? (
          <textarea
            aria-label={label}
            value={value}
            onChange={(e) => change(e.target.value)}
            required={required}
            maxLength={max}
            rows={3}
          />
        )
        : (
          <input
            aria-label={label}
            type={type}
            value={value}
            onChange={(e) => change(e.target.value)}
            required={required}
            maxLength={type === "color" ? undefined : max}
            pattern={pattern}
          />
        )}
    </label>
  );
}
export function RecipientFields(
  { value: v, onChange }: {
    value: Recipient;
    onChange: (value: Recipient) => void;
  },
) {
  const set = <K extends keyof Recipient>(key: K, value: Recipient[K]) =>
    onChange({ ...v, [key]: value });
  return (
    <div className="invoice-party-fields">
      <label className="admin-field">
        <span>Typ odběratele</span>
        <select
          aria-label="Typ odběratele"
          value={v.client_type}
          onChange={(e) =>
            onChange({
              ...v,
              client_type: e.target.value as Recipient["client_type"],
              ...(e.target.value === "person"
                ? { company_name: "", ico: "" }
                : {}),
            })}
        >
          <option value="person">Soukromá osoba</option>
          <option value="company">Firma nebo podnikatel</option>
        </select>
      </label>
      <Text
        label="Jméno klienta"
        value={v.first_name}
        change={(x) => set("first_name", x)}
        required={v.client_type === "person"}
        max={100}
      />
      <Text
        label="Příjmení klienta"
        value={v.last_name}
        change={(x) => set("last_name", x)}
        required={v.client_type === "person"}
        max={100}
      />
      {v.client_type === "company" && (
        <>
          <Text
            label="Název firmy klienta"
            value={v.company_name}
            change={(x) => set("company_name", x)}
            required
            max={160}
          />
          <Text
            label="IČO firmy / zahraniční identifikátor"
            value={v.ico}
            change={(x) => set("ico", x)}
            required={v.country_code === "CZ"}
            max={30}
            pattern={v.country_code === "CZ" ? "[0-9]{8}" : undefined}
          />
        </>
      )}
      <Text
        label="E-mail klienta"
        value={v.email}
        change={(x) => set("email", x)}
        required
        type="email"
        max={254}
      />
      <Text
        label="Fakturační adresa klienta (ulice, město, PSČ)"
        value={v.address}
        change={(x) => set("address", x)}
        required
        max={1000}
        area
      />
      <label className="admin-field">
        <span>Země klienta</span>
        <select
          aria-label="Země klienta"
          value={v.country_code}
          onChange={(e) => set("country_code", e.target.value)}
          required
        >
          <option value="" disabled>Vyber zemi</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </label>
      <Text
        label="Web klienta (volitelný)"
        value={v.website}
        change={(x) => set("website", x)}
        type="url"
        max={500}
      />
      <label className="admin-check">
        <input
          type="checkbox"
          checked={v.vat_registered}
          onChange={(e) => set("vat_registered", e.target.checked)}
        />{" "}
        Klient je plátce DPH
      </label>
      {(v.vat_registered || v.vat_id) && (
        <Text
          label="DIČ klienta"
          value={v.vat_id}
          change={(x) => set("vat_id", x)}
          required={v.vat_registered}
          max={40}
        />
      )}
      <p className="admin-small">
        U soukromé osoby vyplň jméno a příjmení, u firmy její právní název. Web
        je volitelný. E-mail slouží také pro kontakt v databázi klientů.
      </p>
    </div>
  );
}
export function SupplierFields(
  { value: v, onChange }: {
    value: Business;
    onChange: (value: Business) => void;
  },
) {
  const set = <K extends keyof Business>(key: K, value: Business[K]) =>
    onChange({ ...v, [key]: value });
  return (
    <div className="invoice-party-fields">
      <Text
        label="Dodavatel: obchodní jméno"
        value={v.legal_name}
        change={(x) => set("legal_name", x)}
        required
        max={160}
      />
      <Text
        label="Dodavatel: IČO"
        value={v.ico}
        change={(x) => set("ico", x)}
        required
        max={8}
        pattern="[0-9]{8}"
      />
      <Text
        label="Dodavatel: sídlo včetně země"
        value={v.address}
        change={(x) => set("address", x)}
        required
        max={1000}
        area
      />
      <Text
        label="Zápis v rejstříku nebo evidenci"
        value={v.registration || ""}
        change={(x) => set("registration", x)}
        required
        max={1000}
        area
      />
      <p className="admin-small">
        U živnostníka například „Fyzická osoba zapsaná v živnostenském
        rejstříku“. U společnosti doplň skutečný soud, oddíl a vložku.
      </p>
      <Text
        label="Dodavatel: bankovní účet nebo IBAN"
        value={v.bank_account}
        change={(x) => set("bank_account", x)}
        required
      />
      <label className="admin-field">
        <span>Dodavatel: plátcovství DPH</span>
        <select
          aria-label="Dodavatel: plátcovství DPH"
          value={v.vat_registered === null
            ? ""
            : v.vat_registered
            ? "yes"
            : "no"}
          required
          onChange={(e) => set("vat_registered", e.target.value === "yes")}
        >
          <option value="" disabled>Vyber stav</option>
          <option value="no">Nejsem plátce DPH</option>
          <option value="yes">Jsem plátce DPH</option>
        </select>
      </label>
      {(v.vat_registered || v.vat_id) && (
        <Text
          label="Dodavatel: DIČ"
          value={v.vat_id}
          change={(x) => set("vat_id", x)}
          required={v.vat_registered === true}
          max={40}
        />
      )}
      <Text
        label="Název značky na faktuře"
        value={v.brand_name || ""}
        change={(x) => set("brand_name", x)}
        max={160}
      />
      <label className="admin-field">
        <span>Logo na faktuře</span>
        <select
          aria-label="Logo na faktuře"
          value={v.logo_style || "site"}
          onChange={(e) =>
            set("logo_style", e.target.value as Business["logo_style"])}
        >
          <option value="site">Značka ap. jako na webu</option>
          <option value="original">Původní logo Adam Pruška</option>
          <option value="none">Pouze název značky</option>
        </select>
      </label>
      <Text
        label="Barva faktury"
        value={v.accent_color || "#d7202b"}
        change={(x) => set("accent_color", x)}
        type="color"
        max={7}
      />
      <Text
        label="Kontaktní e-mail dodavatele"
        value={v.contact_email || ""}
        change={(x) => set("contact_email", x)}
        type="email"
        max={254}
      />
      <Text
        label="Kontaktní telefon dodavatele"
        value={v.contact_phone || ""}
        change={(x) => set("contact_phone", x)}
        type="tel"
        max={60}
      />
      <Text
        label="Web dodavatele"
        value={v.website || ""}
        change={(x) => set("website", x)}
        type="url"
        max={500}
      />
      <Text
        label="Poznámka na dokladu"
        value={v.invoice_note}
        change={(x) => set("invoice_note", x)}
        max={1000}
        area
      />
    </div>
  );
}
