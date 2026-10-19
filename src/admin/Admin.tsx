import { MailClient, type MailContext } from "./MailClient";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { db, api, configured, money, priceMinor, projectUrl } from "./client";
import type {
  Business,
  Invoice,
  Integrations,
  Snapshot,
} from "./types";
import { internalUrl } from "../routes";
import { PRICES, STUDENT_PRICES } from "../pricing.mjs";
import { InvoiceForm } from "./InvoiceForm";
import { InvoiceDocument } from "./InvoiceDocument";
import "./admin.css";

const sections = [
  ["overview", "Přehled"],
  ["analytics", "Návštěvnost"],
  ["bookings", "Rezervace"],
  ["clients", "Klienti"],
  ["orders", "Objednávky"],
  ["invoices", "Faktury"],
  ["mail", "Pošta"],
  ["tasks", "Úkoly"],
  ["settings", "Nastavení"],
] as const;
type Section = (typeof sections)[number][0];
function AdminIcon({ kind = "arrow" }: { kind?: string }) {
  const paths: Record<string, string> = {
    arrow: "M6 18 18 6M6 6h12v12",
    overview: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
    analytics: "M3 20h18M5 15l5-5 4 3 6-9",
    bookings: "M4 6h16v15H4zM8 3v6m8-6v6M4 11h16",
    clients:
      "M15 21v-3c0-5-12-5-12 0v3m17 0v-4c0-2-1-3-3-4M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-3c4 0 4 7 0 7",
    orders: "M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5",
    invoices: "M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h6",
    mail: "M3 5h18v14H3zM3 6l9 7 9-7",
    tasks: "M4 12l5 5L20 6",
    settings:
      "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    refresh: "M20 8a8 8 0 1 0 0 8M20 3v5h-5",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={paths[kind] || paths.arrow}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const statusLabel: Record<string, string> = {
  pending: "Čeká na úhradu",
  paid: "Uhrazeno",
  cancelled: "Zrušeno",
  refunded: "Vráceno",
  accepted: "Potvrzeno",
  sent: "Odesláno",
  sending: "Odesílání",
  uncertain: "Nutná kontrola",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(new Date(value));
function inputDate(days = 0) {
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Prague",
  }).format(new Date());
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const fields = (event: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(event.currentTarget)) as Record<
    string,
    string
  >;
function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  maxLength = 300,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={["date", "color"].includes(type) ? undefined : maxLength}
      />
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="admin-empty">
      <span aria-hidden="true">
        <AdminIcon />
      </span>
      <p>{children}</p>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`admin-badge status-${value}`}>
      {statusLabel[value] || value}
    </span>
  );
}
function assurance(session: Session | null) {
  try {
    return (
      JSON.parse(
        atob(
          session!.access_token
            .split(".")[1]
            .replaceAll("-", "+")
            .replaceAll("_", "/"),
        ),
      ).aal || "aal1"
    );
  } catch {
    return "aal1";
  }
}
const setupUrl =
  "https://github.com/pruskaadam-hub/consulting-page/blob/main/docs/admin-setup.md";

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [allowed, setAllowed] = useState(false);
  const [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [secret, setSecret] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!db) {
      setChecking(false);
      return;
    }
    let active = true;
    db.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setChecking(false);
      }
    });
    const { data } = db.auth.onAuthStateChange((_event, next) => {
      if (active) {
        if (!next) setReady(false);
        setSession(next);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    setReady(false);
    setAllowed(false);
    setFactor("");
    setQr("");
    setSecret("");
    if (!db || !session) return;
    let active = true;
    setChecking(true);
    void (async () => {
      try {
        const member = await db!
          .from("admin_users")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (member.error || !member.data)
          throw new Error("Tento účet nemá přístup do administrace.");
        const permission = await db!.rpc("is_admin");
        if (permission.error)
          throw new Error("Oprávnění se nepodařilo ověřit.");
        if (!active) return;
        setAllowed(true);
        if (permission.data === true) {
          setReady(true);
          return;
        }
        const factors = await db!.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const verified = factors.data.totp.find(
          (item) => item.status === "verified",
        );
        if (active) setFactor(verified?.id || "");
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Přístup se nepodařilo ověřit.",
          );
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user.id, assurance(session)]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");
    try {
      const f = fields(event);
      const result = await db.auth.signInWithPassword({
        email: f.email,
        password: f.password,
      });
      if (result.error)
        throw new Error("Přihlášení se nepodařilo. Zkontroluj e-mail a heslo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Přihlášení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    if (!db || busy) return;
    setBusy(true);
    setError("");
    try {
      const existing = await db.auth.mfa.listFactors();
      for (const item of existing.data?.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      ) || [])
        await db.auth.mfa.unenroll({ factorId: item.id });
      const result = await db.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Správa Adam Pruška",
      });
      if (result.error) throw result.error;
      setFactor(result.data.id);
      setQr(
        result.data.totp.qr_code.startsWith("data:")
          ? result.data.totp.qr_code
          : `data:image/svg+xml,${encodeURIComponent(result.data.totp.qr_code)}`,
      );
      setSecret(result.data.totp.secret);
    } catch {
      setError("Ověřování se nepodařilo připravit. Zkus to znovu.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");
    try {
      const f = fields(event);
      const result = await db.auth.mfa.challengeAndVerify({
        factorId: factor,
        code: f.code,
      });
      if (result.error) throw result.error;
      const current = await db.auth.getSession();
      setSession(current.data.session);
    } catch {
      setError(
        "Ověřovací kód není platný. Zkontroluj čas v telefonu a zkus nový kód.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setReady(false);
    setAllowed(false);
    setError("");
    setQr("");
    setSecret("");
    await db?.auth.signOut({ scope: "local" });
    setSession(null);
  }
  if (ready && session)
    return <Workspace logout={logout} email={session.user.email || ""} />;
  return (
    <div className="admin-root admin-gateway">
      <a className="admin-back" href={internalUrl("cs")}>
        ← Zpět na web
      </a>
      <main className="admin-login-layout">
        <section className="admin-login-copy">
          <a className="admin-wordmark" href={internalUrl("cs")}>
            <span>ap.</span> Adam Pruška
          </a>
          <p className="admin-kicker">Soukromá administrace</p>
          <h1>
            Všechno pod
            <br />
            <em>jednou střechou.</em>
          </h1>
          <p>
            Klienti, konzultace, finance a pošta.
            <br />
            Prostor pro tvoje podnikání.
          </p>
          <div className="admin-feature-grid">
            {[
              "Návštěvnost a zájem",
              "Rezervace a klienti",
              "Objednávky a faktury",
              "Firemní pošta",
            ].map((text, i) => (
              <div key={text}>
                <span aria-hidden="true">
                  <AdminIcon
                    kind={["analytics", "bookings", "invoices", "mail"][i]}
                  />
                </span>
                {text}
              </div>
            ))}
          </div>
          <p className="admin-login-note">
            Přístup pouze pro správce. Citlivá data jsou chráněna přihlášením a
            druhým ověřovacím kódem.
          </p>
        </section>
        <section className="admin-login-box" aria-labelledby="login-title">
          <div className="admin-lock" aria-hidden="true">
            <AdminIcon />
          </div>
          <h2 id="login-title">
            {session ? "Ověření správce" : "Vítej zpátky."}
          </h2>
          {checking ? (
            <p role="status">Ověřuji přihlášení…</p>
          ) : !configured ? (
            <>
              <p>
                {globalThis.isSecureContext ? "Připojení administrace zatím není aktivní. Přihlášení se zpřístupní po propojení Supabase projektu." : "Administraci otevři přes zabezpečenou HTTPS adresu. Pokud se ještě připravuje certifikát, počkej na dokončení nastavení domény."}
              </p>
              <div className="admin-setup-status">
                <strong>Projekt je připravený k propojení</strong>
                <span>Účet správce: pruskaadam@me.com</span>
                <span>Obchodní pošta: adam@adampruska.cz</span>
              </div>
              <a
                className="button primary"
                href={setupUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Postup propojení <AdminIcon />
              </a>
            </>
          ) : !session ? (
            <form onSubmit={login}>
              <Field
                label="E-mail správce"
                name="email"
                type="email"
                value="pruskaadam@me.com"
                required
              />
              <Field
                label="Heslo"
                name="password"
                type="password"
                required
                maxLength={256}
              />
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? "Přihlašuji…" : "Přihlásit se"} <AdminIcon />
              </button>
              <p className="admin-small">
                Přístup je určen pouze pozvanému správci. Veřejná registrace
                není dostupná.
              </p>
            </form>
          ) : allowed ? (
            <>
              {!factor ? (
                <>
                  <p>
                    Nejdřív přidej ověřovací aplikaci, například Google
                    Authenticator nebo 1Password.
                  </p>
                  <button
                    className="button primary"
                    type="button"
                    onClick={enroll}
                    disabled={busy}
                  >
                    Nastavit druhý faktor
                  </button>
                </>
              ) : (
                <>
                  {qr && (
                    <>
                      <img
                        className="admin-qr"
                        src={qr}
                        alt="QR kód pro nastavení ověřovací aplikace"
                      />
                      <p className="admin-small">
                        Ruční klíč: <code>{secret}</code>
                      </p>
                    </>
                  )}
                  <form onSubmit={verify}>
                    <label className="admin-field">
                      <span>Kód z ověřovací aplikace</span>
                      <input
                        type="text"
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                      />
                    </label>
                    <button
                      className="button primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? "Ověřuji…" : "Otevřít administraci"}
                    </button>
                  </form>
                </>
              )}
              <button
                className="admin-text-button"
                type="button"
                onClick={logout}
              >
                Odhlásit se
              </button>
            </>
          ) : (
            <button className="button primary" type="button" onClick={logout}>
              Přihlásit se jiným účtem
            </button>
          )}
        </section>
        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

function Workspace({
  logout,
  email,
}: {
  logout: () => Promise<void>;
  email: string;
}) {
  const [mailContext,setMailContext]=useState<MailContext|null>(null);
  const [section, setSection] = useState<Section>("overview"),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [integration, setIntegration] = useState<Integrations | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [calCommunication,setCalCommunication]=useState<{calendarEmail:string;calendarUsername:string;sender:string;mailDelivery?:{status:string};mailRead:boolean;mailSend:boolean;mailProvider:string;confirmationProvider:string;managementLinkEmail:boolean} | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null),
    [paymentLink, setPaymentLink] = useState("");
  const [ga, setGa] = useState<{
    days: { date: string; users: number; sessions: number; views: number }[];
    totals: { users: number; sessions: number; views: number };
  } | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [section]);
  const calLoaded=useRef(false);
  useEffect(()=>{
    if(section!=='bookings' || !integration?.bookings || busy || calLoaded.current)return;
    calLoaded.current=true;
    void work(()=>api('/cal/sync',{}),'Rezervace z Cal.com byly načteny.');
  },[section,integration?.bookings,busy]);
  async function reload() {
    if (!db) return;
    const results = await Promise.all([
      db
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("orders")
        .select("*,clients(name,email)")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("bookings")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(100),
      db
        .from("invoices")
        .select("*,orders(status)")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("mail_outbox")
        .select("id,recipient,subject,status,created_at,transport,sent_copy_saved")
        .order("created_at", { ascending: false })
        .limit(25),
      db.from("business_settings").select("*").eq("id", true).single(),
      db.rpc("business_summary"),
      db
        .from("stripe_invoices")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    if (results.some((r) => r.error))
      throw new Error(
        "Přehledy se nepodařilo načíst. Ověř připojení a databázovou migraci.",
      );
    setSnapshot({
      clients: results[0].data,
      orders: results[1].data,
      bookings: results[2].data,
      invoices: results[3].data,
      tasks: results[4].data,
      outbox: results[5].data,
      business: results[6].data,
      summary: results[7].data,
      stripeInvoices: results[8].data,
    } as Snapshot);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    void reload()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void api("/status")
      .then((value) => {
        if (active) setIntegration(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Backendová propojení zatím nejsou dostupná. Databázové přehledy lze používat samostatně.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function work(action: () => Promise<unknown>, success = "Uloženo.") {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await action();
      await reload();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operace se nezdařila.");
    } finally {
      setBusy(false);
    }
  }
  async function mutate(
    table: string,
    values: Record<string, unknown>,
    id?: string,
  ) {
    const result = id
      ? await db!.from(table).update(values).eq("id", id)
      : await db!.from(table).insert(values);
    if (result.error)
      throw new Error(
        "Záznam se nepodařilo uložit. Zkontroluj povinné údaje a případné duplicity.",
      );
  }
  const s = snapshot;
  return (
    <div className="admin-root admin-workspace">
      <a className="skip-link" href="#admin-main">
        Přejít k obsahu
      </a>
      <aside className="admin-sidebar" aria-label="Navigace správce">
        <a className="admin-wordmark" href={internalUrl("cs")}>
          <span>ap.</span>
          <span>
            Adam Pruška<small>Správa podnikání</small>
          </span>
        </a>
        <nav aria-label="Administrace">
          {sections.map(([key, label], index) => (
            <button
              key={key}
              type="button"
              aria-current={section === key ? "page" : undefined}
              onClick={() => {
                setSection(key);
                setInvoice(null);
                setError("");
                setNotice("");
              }}
            >
              <span aria-hidden="true">
                <AdminIcon kind={key} />
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span>{email}</span>
          <button type="button" onClick={logout}>
            Odhlásit se <AdminIcon />
          </button>
          <a href={internalUrl("cs")}>
            Otevřít veřejný web <AdminIcon />
          </a>
        </div>
      </aside>
      <main className="admin-main" id="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Tvoje podnikání</p>
            <h1>{sections.find(([key]) => key === section)?.[1]}</h1>
          </div>
          <button
            className="admin-outline"
            type="button"
            disabled={busy || loading}
            onClick={() => void work(reload, "Přehled je aktuální.")}
          >
            Obnovit <AdminIcon kind="refresh" />
          </button>
        </header>
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Načítám přehledy…</p>
        ) : !s ? (
          <Empty>
            Přehledy se nepodařilo načíst. Zkus je obnovit nebo zkontroluj
            nastavení projektu.
          </Empty>
        ) : (
          <>
            {section === "overview" && (
              <>
                <div className="admin-welcome">
                  <h2>Ahoj, Adame.</h2>
                  <p>Co dnes posune tvoje podnikání dál?</p>
                  <span>{date(new Date().toISOString())}</span>
                </div>
                <div className="admin-stats">
                  {[
                    [
                      "Uhrazené příjmy",
                      money(s.summary.revenue),
                      "Všechny evidované úhrady",
                    ],
                    [
                      "Tento měsíc",
                      money(s.summary.month_revenue),
                      "Podle data přijetí úhrady",
                    ],
                    [
                      "Čeká na úhradu",
                      String(s.summary.pending),
                      "Neuhrazené objednávky",
                    ],
                    [
                      "Klienti",
                      String(s.summary.clients),
                      "Kontakty v databázi",
                    ],
                  ].map(([label, value, note]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{note}</small>
                    </article>
                  ))}
                </div>
                <div className="admin-two-col">
                  <Panel title="Na řadě jsou konzultace">
                    {s.bookings
                      .filter(
                        (b) =>
                          b.status === "accepted" &&
                          new Date(b.starts_at) > new Date(),
                      )
                      .slice(0, 5)
                      .map((b) => (
                        <div className="admin-list-row" key={b.uid}>
                          <div>
                            <strong>{b.name}</strong>
                            <span>{b.title}</span>
                          </div>
                          <span>{date(b.starts_at)}</span>
                        </div>
                      ))}
                    {!s.bookings.some(
                      (b) =>
                        b.status === "accepted" &&
                        new Date(b.starts_at) > new Date(),
                    ) && (
                      <Empty>
                        {integration?.bookings
                          ? "Zatím žádné nadcházející rezervace."
                          : "Propoj Cal.com, aby se zde objevily skutečné rezervace."}
                      </Empty>
                    )}
                  </Panel>
                  <Panel title="Co je potřeba dokončit">
                    {s.tasks
                      .filter((t) => !t.done)
                      .slice(0, 5)
                      .map((t) => (
                        <div className="admin-list-row" key={t.id}>
                          <span>{t.title}</span>
                          <button
                            className="admin-text-button"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void work(() =>
                                mutate("tasks", { done: true }, t.id),
                              )
                            }
                          >
                            Hotovo ✓
                          </button>
                        </div>
                      ))}
                    {!s.tasks.some((t) => !t.done) && (
                      <Empty>
                        Žádné otevřené úkoly. Další kroky si přidej v sekci
                        Úkoly.
                      </Empty>
                    )}
                  </Panel>
                </div>
                <Panel title="Propojení služeb">
                  <Connections integration={integration} />
                </Panel>
                <p className="admin-small">
                  Rezervace, zájem o konzultaci a zaplacená objednávka jsou
                  samostatné údaje. Příjmy zahrnují jen potvrzené úhrady.
                </p>
              </>
            )}
            {section === "analytics" && (
              <>
                <Panel title="Google Analytics 4">
                  <p>
                    Posledních 30 celých dnů. Měření se spouští až po souhlasu
                    návštěvníka.
                  </p>
                  {integration?.analytics ? (
                    <button
                      className="admin-outline"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void work(
                          async () => setGa(await api("/analytics")),
                          "Google Analytics načteno.",
                        )
                      }
                    >
                      Načíst Google Analytics
                    </button>
                  ) : (
                    <Empty>
                      GA4 ještě není propojené. Nejdřív vytvoř službu a doplň
                      její nastavení.
                    </Empty>
                  )}
                  {ga && (
                    <>
                      <div className="admin-stats">
                        {[
                          ["Uživatelé", ga.totals.users],
                          ["Návštěvy", ga.totals.sessions],
                          ["Zobrazení", ga.totals.views],
                        ].map(([label, value]) => (
                          <article key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </article>
                        ))}
                      </div>
                      {ga.days.length > 0 ? (
                        <svg
                          className="admin-chart"
                          viewBox="0 0 600 120"
                          role="img"
                          aria-label="Vývoj počtu zobrazení za posledních třicet dnů"
                        >
                          <polyline
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            points={ga.days
                              .map(
                                (d, i) =>
                                  `${ga.days.length > 1 ? (i / (ga.days.length - 1)) * 590 + 5 : 300},${110 - (d.views / Math.max(1, ...ga.days.map((p) => p.views))) * 100}`,
                              )
                              .join(" ")}
                          />
                        </svg>
                      ) : (
                        <Empty>GA4 za toto období nevrátilo žádná data.</Empty>
                      )}
                    </>
                  )}
                </Panel>
                <EventSummary />
              </>
            )}
            {section === "bookings" && (
              <Panel title="Rezervace z Cal.com">
                <p>
                  Přehled uložených rezervací z Cal.com. Nové rezervace z webu a jejich storna se ukládají přímo. Tlačítkem načteš také starší rezervace a změny provedené v Cal.com. Obě strany mohou rezervaci zrušit nejpozději 24 hodin předem.
                </p>
                <button type="button" disabled={busy || !integration?.bookings} onClick={()=>work(()=>api('/cal/sync',{}),'Přehled rezervací byl aktualizován.')}>Načíst rezervace z Cal.com</button>
                <button type="button" disabled={busy || !integration?.bookings} onClick={()=>work(async()=>{setCalCommunication(await api('/cal/communication'));},'Nastavení komunikace načteno.')}>Ověřit e-mailovou komunikaci</button>
                {calCommunication && <div className="admin-note"><h3>Rezervace a e-maily</h3><p>Účet Cal.com: <strong>{calCommunication.calendarEmail}</strong> ({calCommunication.calendarUsername})</p><p>Potvrzení rezervací: {calCommunication.confirmationProvider==='app' ? 'odesílá webová aplikace z adam@adampruska.cz' : 'odesílá Cal.com; aplikace druhé potvrzení neposílá'}.</p><p>Pošta administrace: <strong>{calCommunication.sender}</strong>. Čtení: {calCommunication.mailRead ? 'připojeno' : 'nenastaveno'}. Odesílání: {calCommunication.mailSend ? 'připraveno' : 'nenastaveno'}. {calCommunication.mailProvider==='icloud' && 'Běžnou poštu vyřizuj v iCloud Mail. Rezervační potvrzení spravuje Cal.com.'}</p><p>Ověření odesílání: {({cal_managed:'rezervační potvrzení posílá Cal.com, Resend není potřeba',ready:'doména Resend je ověřená',missing_key:'chybí RESEND_API_KEY v Supabase',sender_mismatch:'odesílatel není adam@adampruska.cz',key_rejected:'Resend klíč nebyl přijat',key_scope_unknown:'tento klíč neumožňuje ověřit domény; zkontroluj doménu v Resend',domain_missing:'doména adampruska.cz není v Resend přidaná',domain_pending:'doména čeká na ověření DNS',smtp_unverified:'SMTP je nastavené, odeslání nebylo testováno',missing_credentials:'chybí přístup k odesílání',check_unavailable:'stav služby se nepodařilo ověřit'} as Record<string,string>)[calCommunication.mailDelivery?.status || ''] || 'stav nebyl ověřen'}.</p><p>{calCommunication.managementLinkEmail ? 'Potvrzení z webu obsahuje odkaz ke zrušení i dostupný odkaz na online schůzku.' : 'Soukromý odkaz ke zrušení se zobrazuje na webu. Automatický e-mail s tímto odkazem není zapnutý.'}</p><p>Příjemce oznámení, další adresy a pravidla v Cal.com nebo přeposílání v poštovní schránce je potřeba ověřit v příslušných účtech.</p></div>}
                {s.bookings.length ? (
                  <div className="admin-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Klient</th>
                          <th scope="col">Konzultace</th>
                          <th scope="col">Termín</th>
                          <th scope="col">Stav</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.bookings.map((b) => (
                          <tr key={b.uid}>
                            <td>
                              {b.name}
                              <small>{b.email}</small>
                            </td>
                            <td>{b.title}</td>
                            <td>
                              {date(b.starts_at)}
                              <small>
                                {new Date(b.starts_at).toLocaleTimeString(
                                  "cs-CZ",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Europe/Prague",
                                  },
                                )}
                              </small>
                            </td>
                            <td>
                              <Status
                                value={
                                  b.status === "pending"
                                    ? "Čeká na potvrzení"
                                    : b.status
                                }
                              />
                              {b.status !== 'cancelled' && Date.parse(b.starts_at)-Date.now()>=86400000 && <button type="button" disabled={busy} onClick={()=>work(()=>api('/cal/cancel',{uid:b.uid}),'Rezervace zrušena.')}>Zrušit rezervaci</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>
                    {integration?.bookings
                      ? "Zatím tu nejsou uložené rezervace. Načti je z Cal.com tlačítkem výše."
                      : "Připoj Cal.com API v Supabase Secrets a potom načti rezervace tlačítkem výše."}
                  </Empty>
                )}
              </Panel>
            )}
            {section === "clients" && (
              <div className="admin-two-col">
                <Panel title="Klienti">
                  <p>Posledních 100 kontaktů.</p>
                  {s.clients.map((c) => (
                    <div className="admin-list-row" key={c.id}>
                      <div>
                        <strong>{c.name}</strong>
                        <span>{c.email}</span>
                        {c.company_name && c.company_name !== c.name && <span>{c.company_name}</span>}
                        {(c.first_name || c.last_name) && <span>{[c.first_name,c.last_name].filter(Boolean).join(" ")}</span>}
                        {c.ico && <span>IČO: {c.ico}</span>}
                        {c.website && <span>{c.website}</span>}
                        <span>
                          {c.address || "Fakturační adresa není vyplněná."}
                        </span>
                      </div>
                      <div className="mail-contact-actions">
                        <button className="admin-outline" type="button" onClick={()=>{setMailContext({email:c.email,mode:"compose",nonce:Date.now()});setSection("mail");}}>Napsat e-mail</button>
                        <button className="admin-outline" type="button" onClick={()=>{setMailContext({email:c.email,mode:"history",nonce:Date.now()});setSection("mail");}}>Korespondence</button>
                      </div>
                    </div>
                  ))}
                  {!s.clients.length && (
                    <Empty>
                      Přidej prvního klienta. Údaje slouží pro objednávky a
                      faktury.
                    </Empty>
                  )}
                </Panel>
                <Panel title="Nový klient">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = fields(e),
                        form = e.currentTarget;
                      void work(async () => {
                        await mutate("clients", f);
                        form.reset();
                      });
                    }}
                  >
                    <Field
                      label="Jméno nebo firma"
                      name="name"
                      required
                      maxLength={160}
                    />
                    <Field
                      label="E-mail"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                    />
                    <Field
                      label="Fakturační adresa včetně země"
                      name="address"
                      maxLength={1000}
                    />
                    <Field
                      label="IČO, pokud jde o firmu"
                      name="ico"
                      maxLength={30}
                    />
                    <Field
                      label="DIČ klienta, pokud je relevantní"
                      name="vat_id"
                      maxLength={40}
                    />
                    <label className="admin-field">
                      <span>Poznámka</span>
                      <textarea name="notes" maxLength={5000} />
                    </label>
                    <button
                      className="button primary"
                      type="submit"
                      disabled={busy}
                    >
                      Uložit klienta
                    </button>
                  </form>
                </Panel>
              </div>
            )}
            {section === "orders" && (
              <>
                <Panel title="Objednávky a úhrady">
                  {integration?.stripe_mode === "test" && integration.payments && (
                    <p className="admin-notice" role="status">
                      Stripe je v testovacím režimu. Platební odkazy nepřijímají
                      skutečné peníze. Testovací úhrady se nezapočítávají do příjmů.
                    </p>
                  )}
                  <p>
                    Posledních 100 objednávek. Pro platbu převodem vytvoř
                    objednávku a v sekci Faktury vystav fakturu. Úhradu označ
                    až po přijetí peněz na účet.
                  </p>
                  {paymentLink && (
                    <p className="admin-notice">
                      Platební odkaz:{" "}
                      <a
                        href={paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Otevřít Stripe Checkout <AdminIcon />
                      </a>
                      <input
                        type="text"
                        aria-label="Platební odkaz ke kopírování"
                        value={paymentLink}
                        readOnly
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </p>
                  )}
                  {s.orders.length ? (
                    <div className="admin-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Klient a nabídka</th>
                            <th scope="col">Cena</th>
                            <th scope="col">Stav</th>
                            <th scope="col">Akce</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.orders.map((o) => (
                            <tr key={o.id}>
                              <td>
                                {o.clients?.name}
                                <small>{o.description}</small>
                              </td>
                              <td>{money(o.amount_minor)}</td>
                              <td>
                                <Status value={o.status} />
                                {o.is_test && <span className="admin-badge">Testovací platba</span>}
                                <small>
                                  {o.source === "stripe"
                                    ? o.status === "paid"
                                      ? "Úhrada ze Stripe"
                                      : "Evidence Stripe"
                                    : "Ruční evidence"}
                                </small>
                              </td>
                              <td>
                                {o.status === "pending" && (
                                  <>
                                    {integration?.payments && <button
                                      className="admin-text-button"
                                      type="button"
                                      disabled={busy || !integration?.payments}
                                      onClick={() =>
                                        void work(
                                          async () =>
                                            setPaymentLink(
                                              (
                                                await api("/checkout", {
                                                  order_id: o.id,
                                                })
                                              ).url,
                                            ),
                                          "Platební odkaz je připravený.",
                                        )
                                      }
                                    >
                                      Platební odkaz
                                    </button>}
                                    {o.source === "manual" && (
                                      <>
                                        <button
                                          className="admin-text-button"
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            void work(() =>
                                              mutate(
                                                "orders",
                                                {
                                                  status: "paid",
                                                  paid_at:
                                                    new Date().toISOString(),
                                                },
                                                o.id,
                                              ),
                                            )
                                          }
                                        >
                                          Označit ručně uhrazené
                                        </button>
                                        <button
                                          className="admin-text-button"
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            void work(() =>
                                              mutate(
                                                "orders",
                                                { status: "cancelled" },
                                                o.id,
                                              ),
                                            )
                                          }
                                        >
                                          Zrušit
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty>
                      Žádné objednávky. Kliknutí na konzultaci ani rezervace
                      samy o sobě nákup nevytvářejí.
                    </Empty>
                  )}
                </Panel>
                <Panel title="Nová objednávka">
                  <form
                    className="admin-form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = fields(e);
                      void work(
                        () =>
                          mutate("orders", {
                            client_id: f.client_id,
                            description: f.description,
                            amount_minor: priceMinor(f.amount),
                          }),
                        "Objednávka byla vytvořena.",
                      );
                    }}
                  >
                    <label className="admin-field">
                      <span>Klient</span>
                      <select name="client_id" required defaultValue="">
                        <option value="" disabled>
                          Vyber klienta
                        </option>
                        {s.clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Popis služby" name="description" required />
                    <label className="admin-field">
                      <span>Celková cena v Kč</span>
                      <input
                        type="text"
                        name="amount"
                        inputMode="decimal"
                        required
                        defaultValue={PRICES.individual}
                      />
                    </label>
                    <button
                      className="button primary"
                      type="submit"
                      disabled={busy || !s.clients.length}
                    >
                      Vytvořit objednávku
                    </button>
                  </form>
                  <p className="admin-small">
                    Ceník: individuální {PRICES.individual} Kč, studenti{" "}
                    {STUDENT_PRICES.individual} Kč. Balíček {PRICES.package} Kč,
                    studenti {STUDENT_PRICES.package} Kč. Částka objednávky je
                    konečná včetně případné DPH.
                  </p>
                </Panel>
              </>
            )}
            {section === "invoices" && (
              <>
                {(integration?.payment_mode === "stripe" || s.stripeInvoices.length > 0) && <Panel title="Faktury Stripe">
                  <p>
                    Po úspěšné platbě přes Stripe Checkout vystaví Stripe
                    fakturu. Při zapnutí Tax zahrne automaticky vypočtenou daň.
                  </p>
                  {s.stripeInvoices.map((item) => (
                    <div className="admin-list-row" key={item.id}>
                      <div>
                        <strong>{item.number || item.id}</strong>
                        {item.is_test && <span className="admin-badge">Testovací faktura</span>}
                        <span>
                          {money(item.amount_minor)} · {item.status}
                        </span>
                      </div>
                      <div>
                        {item.hosted_url && (
                          <a
                            className="admin-text-button"
                            href={item.hosted_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Otevřít fakturu <AdminIcon />
                          </a>
                        )}
                        {item.pdf_url && (
                          <a
                            className="admin-text-button"
                            href={item.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Stáhnout PDF <AdminIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {!s.stripeInvoices.length && (
                    <Empty>
                      Zatím nejsou přijaté žádné faktury ze Stripe. Je potřeba
                      propojit účet a webhook.
                    </Empty>
                  )}
                </Panel>}
                <Panel title="Vystavené faktury">
                  <p>
                    Fakturu ulož jako PDF a pošli klientovi k platbě převodem.
                    Čísla přiděluje databáze postupně. Vystavená faktura
                    uchovává původní údaje dodavatele i klienta.
                  </p>
                  {s.invoices.map((item) => (
                    <div className="admin-list-row" key={item.id}>
                      <div>
                        <strong>
                          {item.number} · {item.recipient.name}
                        </strong>
                        <span>
                          {money(item.amount_minor)} · splatnost{" "}
                          {date(item.due_date)}
                        </span>
                        <span className={`admin-badge ${item.orders?.status === "paid" ? "status-paid" : item.orders?.status === "pending" && item.due_date < inputDate() ? "status-cancelled" : ""}`}>
                          {item.orders?.status === "pending"
                            ? item.due_date < inputDate() ? "Po splatnosti" : "Čeká na úhradu"
                            : item.orders ? statusLabel[item.orders.status] || item.orders.status : "Stav úhrady neověřen"}
                        </span>
                      </div>
                      <button
                        className="admin-text-button"
                        type="button"
                        onClick={() => setInvoice(item)}
                      >
                        Zobrazit
                      </button>
                    </div>
                  ))}
                  {!s.invoices.length && (
                    <Empty>
                      Zatím žádné faktury. Nejdřív doplň fakturační údaje v
                      Nastavení.
                    </Empty>
                  )}
                </Panel>
                <Panel title="Vystavit fakturu">
                  <InvoiceForm snapshot={s} busy={busy} dueDate={inputDate(14)} today={inputDate()}
                    onIssue={(issue) => void work(async () => setInvoice(await issue()), "Faktura byla vystavena.")}
                  />
                </Panel>
                {invoice && <InvoiceDocument invoice={invoice} />}
              </>
            )}
            {section === "mail" && (
              <MailClient
                readConnected={Boolean(integration?.mail_read ?? integration?.mail)}
                sendConnected={Boolean(integration?.mail_send ?? integration?.mail)}
                clients={s.clients}
                context={mailContext}
                onOpenContacts={()=>setSection("clients")}
                onAddContact={async email=>{await mutate("clients",{name:email,email,address:"",ico:"",vat_id:"",notes:""});}}
                outbox={s.outbox}
                refresh={reload}
              />
            )}
            {section === "tasks" && (
              <Panel title="Další kroky">
                <form
                  className="admin-form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = fields(e),
                      form = e.currentTarget;
                    void work(async () => {
                      await mutate("tasks", {
                        title: f.title,
                        due_date: f.due_date || null,
                      });
                      form.reset();
                    });
                  }}
                >
                  <Field label="Co je potřeba udělat" name="title" required />
                  <Field label="Termín" name="due_date" type="date" />
                  <button
                    className="button primary"
                    type="submit"
                    disabled={busy}
                  >
                    Přidat úkol
                  </button>
                </form>
                {s.tasks.map((t) => (
                  <label className="admin-task" key={t.id}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      disabled={busy}
                      onChange={() =>
                        void work(() =>
                          mutate("tasks", { done: !t.done }, t.id),
                        )
                      }
                    />
                    <span>
                      {t.title}
                      {t.due_date && <small>{date(t.due_date)}</small>}
                    </span>
                  </label>
                ))}
              </Panel>
            )}
            {section === "settings" && (
              <>
                <Panel title="Fakturační údaje">
                  <form
                    className="admin-form-grid"
                    key={JSON.stringify(s.business)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = fields(e);
                      void work(async () => {
                        const result = await db!
                          .from("business_settings")
                          .update({
                            ...f,
                            vat_registered: f.vat_registered === "yes",
                          })
                          .eq("id", true);
                        if (result.error)
                          throw new Error("Údaje se nepodařilo uložit.");
                      });
                    }}
                  >
                    <Field
                      label="Obchodní jméno"
                      name="legal_name"
                      value={s.business.legal_name}
                      required
                    />
                    <Field
                      label="IČO, 8 číslic"
                      name="ico"
                      value={s.business.ico}
                      required
                      maxLength={8}
                    />
                    <Field
                      label="Úplná adresa sídla včetně země"
                      name="address"
                      value={s.business.address}
                      required
                      maxLength={1000}
                    />
                    <Field
                      label="Bankovní účet nebo IBAN"
                      name="bank_account"
                      value={s.business.bank_account}
                      required
                    />
                    <label className="admin-field">
                      <span>Plátcovství DPH</span>
                      <select
                        name="vat_registered"
                        required
                        defaultValue={
                          s.business.vat_registered === null
                            ? ""
                            : s.business.vat_registered
                              ? "yes"
                              : "no"
                        }
                      >
                        <option value="" disabled>
                          Vyber stav
                        </option>
                        <option value="no">Nejsem plátce DPH</option>
                        <option value="yes">Jsem plátce DPH</option>
                      </select>
                    </label>
                    <Field
                      label="DIČ, povinné pro plátce DPH"
                      name="vat_id"
                      value={s.business.vat_id}
                    />
                    <Field label="Zápis v rejstříku nebo evidenci" name="registration" value={s.business.registration || ""} required maxLength={1000} />
                    <Field label="Název značky na faktuře" name="brand_name" value={s.business.brand_name || "Adam Pruška"} maxLength={160} />
                    <Field label="Kontaktní e-mail dodavatele" name="contact_email" type="email" value={s.business.contact_email || ""} maxLength={254} />
                    <Field label="Kontaktní telefon dodavatele" name="contact_phone" type="tel" value={s.business.contact_phone || ""} maxLength={60} />
                    <Field label="Web dodavatele" name="website" type="url" value={s.business.website || ""} maxLength={500} />
                    <Field label="Barva faktury" name="accent_color" type="color" value={s.business.accent_color || "#d7202b"} />
                    <label className="admin-field"><span>Logo na faktuře</span><select aria-label="Logo na faktuře" name="logo_style" defaultValue={s.business.logo_style || "site"}><option value="site">Značka ap. jako na webu</option><option value="original">Původní logo Adam Pruška</option><option value="none">Pouze název značky</option></select></label>
                    <Field
                      label="Poznámka na faktuře"
                      name="invoice_note"
                      value={s.business.invoice_note}
                      maxLength={1000}
                    />
                    <button
                      className="button primary"
                      type="submit"
                      disabled={busy}
                    >
                      Uložit údaje
                    </button>
                  </form>
                </Panel>
                <Panel title="Propojení služeb">
                  <Connections integration={integration} />
                  <p className="admin-small">
                    {integration?.payment_mode === "stripe" ? <>Stripe režim:{" "}
                    {integration?.stripe_mode === "live"
                      ? "ostrý provoz"
                      : "testovací"}
                    . Tax vyžaduje správné sídlo, registrace a klasifikaci
                    služeb ve Stripe účtu.</> : <>Platby probíhají na fakturu
                    bankovním převodem. Doplň fakturační údaje a bankovní účet
                    výše. Přijaté úhrady eviduješ ručně v Objednávkách.</>}
                  </p>
                  <p className="admin-small">
                    Tajné klíče a heslo ke schránce se nastavují v Supabase
                    Secrets. Nikdy je nevkládej do veřejného GitHub repozitáře.
                  </p>
                  <a
                    className="admin-text-button"
                    href={setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Otevřít postup propojení <AdminIcon />
                  </a>
                  <p className="admin-small">Projekt: {projectUrl}</p>
                </Panel>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function Connections({ integration }: { integration: Integrations | null }) {
  const connections: [string, boolean | undefined, string?][] = [
    ["Příjem pošty", integration?.mail_read ?? integration?.mail],
    ["Odesílání pošty přes iCloud", integration?.mail_send ?? integration?.mail],
    ["GA4: sběr dat na webu", /^G-[A-Z0-9]+$/.test(import.meta.env.VITE_GA4_MEASUREMENT_ID || "")],
    ["GA4: přehledy v administraci", integration?.analytics],
    ...(integration?.payment_mode === "stripe" ? [
      ["Stripe Payments", integration.payments],
      ["Stripe Invoicing", integration.invoicing],
      ["Stripe Tax", integration.tax],
    ] as [string, boolean][] : [
      ["Platby fakturou a převodem", true, "Ruční evidence"],
    ] as [string, boolean, string][]),
    ["Rezervace Cal.com", integration?.bookings],
    ["Měření kliknutí", integration?.events],
  ];
  return (
    <div className="admin-connections">
      {connections.map(([name, on, label]) => (
        <div key={name}>
          <span>{name}</span>
          <span className={`admin-badge ${on ? "status-paid" : ""}`}>
            {label || (on ? "Nastaveno" : "Čeká na propojení")}
          </span>
        </div>
      ))}
    </div>
  );
}
function EventSummary() {
  const [data, setData] = useState<{
      events: { name: string; count: number; sessions: number }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void db!.rpc("analytics_summary").then((result) => {
      if (active) {
        if (result.error) setError("Události se nepodařilo načíst.");
        else setData(result.data);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Panel title="Zájem o konzultace">
      <p>
        Posledních 30 dnů. Anonymní měření po souhlasu, nikoli doklad nákupu.
        Blokování měření a odvolání souhlasu ovlivňují úplnost přehledu.
      </p>
      {error && <p role="alert">{error}</p>}
      {data?.events.length ? (
        <div className="admin-stats">
          {data.events.map((event) => (
            <article key={event.name}>
              <span>
                {
                  {
                    page_view: "Zobrazení stránek",
                    consultation_click: "Kliknutí na konzultace",
                    booking_confirmed: "Potvrzení v prohlížeči",
                  }[event.name]
                }
              </span>
              <strong>{event.count}</strong>
              <small>{event.sessions} relací</small>
            </article>
          ))}
        </div>
      ) : (
        <Empty>Zatím nejsou zaznamenané události.</Empty>
      )}
    </Panel>
  );
}
