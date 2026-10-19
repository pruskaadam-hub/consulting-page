import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "./client";
import type { Client, Message, Outbox } from "./types";
export type MailContext = {
  email: string;
  mode: "compose" | "history";
  nonce: number;
};
type Folder = "inbox" | "sent";
const address = "adam@adampruska.cz";
const messageDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Prague",
    }).format(date)
    : "";
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Poštovní operace se nezdařila.";
export function MailClient({
  readConnected,
  sendConnected,
  clients,
  outbox,
  context,
  refresh,
  onAddContact,
  onOpenContacts,
}: {
  readConnected: boolean;
  sendConnected: boolean;
  clients: Client[];
  outbox: Outbox[];
  context: MailContext | null;
  refresh: () => Promise<void>;
  onAddContact: (email: string) => Promise<void>;
  onOpenContacts: () => void;
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [contact, setContact] = useState(
    context?.mode === "history" ? context.email : "",
  );
  const [messages, setMessages] = useState<Message[]>([]),
    [selected, setSelected] = useState<Message | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null),
    [loading, setLoading] = useState(false),
    [sending, setSending] = useState(false),
    [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [lastSync, setLastSync] = useState("");
  const [compose, setCompose] = useState(context?.mode === "compose"),
    [to, setTo] = useState(context?.mode === "compose" ? context.email : ""),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState("");
  const [inReplyTo, setInReplyTo] = useState(""),
    [references, setReferences] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const draftId = useRef(crypto.randomUUID());
  const epoch = useRef(0), request = useRef(0), detailRequest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = useCallback(async (cursor?: number, quiet = false) => {
    if (!readConnected) return;
    const scope = epoch.current, call = ++request.current;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ folder });
      if (cursor) query.set("cursor", String(cursor));
      if (contact) query.set("contact", contact);
      const result = await api(`/mail?${query}`);
      if (
        !mounted.current || scope !== epoch.current || call !== request.current
      ) return;
      setMessages((old) =>
        cursor
          ? [
            ...old,
            ...result.messages.filter((row: Message) =>
              !old.some((item) => item.uid === row.uid)
            ),
          ]
          : result.messages
      );
      setNextCursor(result.nextCursor || null);
      setLastSync(new Date().toISOString());
    } catch (e) {
      if (
        mounted.current && scope === epoch.current && call === request.current
      ) setError(errorText(e));
    } finally {
      if (mounted.current && call === request.current) setLoading(false);
    }
  }, [folder, contact, readConnected]);
  useEffect(() => {
    epoch.current++;
    setMessages([]);
    setSelected(null);
    setNextCursor(null);
    void load();
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" && !loading && !sending &&
        !syncing
      ) void load(undefined, true);
    }, 60000);
    const focus = () => {
      if (!loading && !sending && !syncing) void load(undefined, true);
    };
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load, loading, sending, syncing]);
  useEffect(() => {
    if (!context) return;
    if (context.mode === "history") {
      setContact(context.email);
      setFolder("inbox");
    } else {
      setTo(context.email);
      setCompose(true);
    }
  }, [context]);
  async function openMessage(uid: number) {
    const scope = epoch.current, call = ++detailRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await api(`/mail?folder=${folder}&uid=${uid}`);
      if (
        mounted.current && scope === epoch.current &&
        call === detailRequest.current
      ) setSelected(result);
    } catch (e) {
      if (mounted.current && scope === epoch.current) setError(errorText(e));
    } finally {
      if (mounted.current && call === detailRequest.current) setLoading(false);
    }
  }
  function newMessage(recipient = "") {
    if (body && !window.confirm("Zahodit rozepsanou zprávu a začít novou?")) {
      return;
    }
    setTo(recipient);
    setSubject("");
    setBody("");
    setInReplyTo("");
    setReferences("");
    setUncertain(false);
    draftId.current = crypto.randomUUID();
    setCompose(true);
    setNotice("");
    setError("");
  }
  function reply() {
    if (!selected) return;
    if (
      body &&
      !window.confirm("Zahodit rozepsanou zprávu a odpovědět na tuto zprávu?")
    ) return;
    setTo(selected.replyTo || selected.from);
    setSubject(
      /^re:/i.test(selected.subject)
        ? selected.subject
        : `Re: ${selected.subject}`,
    );
    setBody("");
    const safeId = /^<[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~@-]+>$/;
    const parent = selected.messageId && safeId.test(selected.messageId)
      ? selected.messageId
      : "";
    setInReplyTo(parent);
    setReferences(
      [
        ...(selected.references || "").split(/\s+/).filter((item) =>
          safeId.test(item)
        ),
        parent,
      ].filter(Boolean).slice(-5).join(" ").slice(-900),
    );
    setUncertain(false);
    draftId.current = crypto.randomUUID();
    setCompose(true);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || uncertain || !sendConnected) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/mail", {
        id: draftId.current,
        to,
        subject,
        text: body,
        ...(inReplyTo ? { inReplyTo } : {}),
        ...(references ? { references } : {}),
      });
      setNotice(
        result.warning ||
          "Zpráva byla odeslána přes iCloud a uložena do Odeslaných.",
      );
      setBody("");
      setSubject("");
      setInReplyTo("");
      setReferences("");
      setCompose(false);
      draftId.current = crypto.randomUUID();
      try {
        await refresh();
      } catch {
        setNotice((old) => old + " Přehled odesílání obnov ručně.");
      }
      if (folder === "sent") await load();
    } catch (e) {
      setUncertain(true);
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }
  async function saveDraft(form: HTMLFormElement | null) {
    if (!form?.reportValidity() || sending || uncertain || !readConnected) {
      return;
    }
    setSending(true);
    setSavingDraft(true);
    setError("");
    setNotice("");
    try {
      await api("/mail/draft", {
        id: draftId.current,
        to,
        subject,
        text: body,
        ...(inReplyTo ? { inReplyTo } : {}),
        ...(references ? { references } : {}),
      });
      setBody("");
      setSubject("");
      setInReplyTo("");
      setReferences("");
      setCompose(false);
      draftId.current = crypto.randomUUID();
      setNotice(
        "Koncept je uložený v iCloud Mail → Koncepty. Otevři ho tam a odešli; v administraci se pak objeví v Odeslaných.",
      );
    } catch (error) {
      setUncertain(true);
      setError(
        errorText(error) + " Před opakováním zkontroluj Koncepty v iCloudu.",
      );
    } finally {
      setSending(false);
      setSavingDraft(false);
    }
  }
  async function synchronize() {
    if (syncing) return;
    setSyncing(true);
    setError("");
    try {
      const result = await api("/mail/sync-sent", {});
      setNotice(`Synchronizace dokončena. Doplněno kopií: ${result.synced}.`);
      await refresh();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSyncing(false);
    }
  }
  async function seen() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      await api("/mail/seen", {
        uid: selected.uid,
        folder,
        seen: !selected.seen,
      });
      setSelected({ ...selected, seen: !selected.seen });
      setMessages((old) =>
        old.map((row) =>
          row.uid === selected.uid ? { ...row, seen: !selected.seen } : row
        )
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  const peer = selected
    ? (folder === "sent" ? selected.to?.split(",")[0]?.trim() : selected.from)
    : "";
  const matched = peer
    ? clients.find((client) =>
      client.email.toLowerCase() === peer.toLowerCase()
    )
    : undefined;
  const recipientContact = clients.find((client) =>
    client.email.toLowerCase() === to.trim().toLowerCase()
  );
  return (
    <>
      <section className="admin-panel mail-client" aria-label="Poštovní klient">
        <div className="mail-heading">
          <div>
            <h2>{address}</h2>
            <p className="admin-small">
              Přijaté a odeslané zprávy se synchronizují s iCloud Mail.
            </p>
          </div>
          <button
            className="button primary"
            type="button"
            disabled={sending}
            onClick={() => newMessage()}
          >
            Napsat zprávu
          </button>
        </div>
        {error && <p className="admin-alert" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {!readConnected
          ? (
            <div className="admin-empty">
              <p>
                Příjem pošty zatím není připojený. V Supabase Secrets ulož
                ICLOUD_USERNAME (adresu iCloud Mail) a ICLOUD_APP_PASSWORD
                (heslo pro aplikaci).
              </p>
            </div>
          )
          : (
            <>
              <div className="mail-toolbar">
                <div
                  className="mail-folders"
                  role="group"
                  aria-label="Poštovní složky"
                >
                  <button
                    type="button"
                    className={folder === "inbox"
                      ? "admin-outline active"
                      : "admin-outline"}
                    aria-pressed={folder === "inbox"}
                    disabled={loading}
                    onClick={() => setFolder("inbox")}
                  >
                    Doručené
                  </button>
                  <button
                    type="button"
                    className={folder === "sent"
                      ? "admin-outline active"
                      : "admin-outline"}
                    aria-pressed={folder === "sent"}
                    disabled={loading}
                    onClick={() => setFolder("sent")}
                  >
                    Odeslané
                  </button>
                </div>
                <label className="admin-field">
                  <span>Korespondence kontaktu</span>
                  <select
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    disabled={loading}
                  >
                    <option value="">Všechny kontakty</option>
                    {contact &&
                      !clients.some((client) => client.email === contact) && (
                      <option value={contact}>{contact}</option>
                    )}
                    {clients.map((client) => (
                      <option key={client.id} value={client.email}>
                        {client.name} · {client.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="admin-outline"
                  type="button"
                  disabled={loading || syncing}
                  onClick={() => void load()}
                >
                  Obnovit poštu
                </button>
              </div>
              <p className="admin-small">
                Zobrazují se jen zprávy pro {address}{" "}
                v Komu/Kopii a zprávy odeslané z této adresy. Osobní pošta
                zůstává skrytá.
              </p>
              {lastSync && (
                <p className="admin-small">
                  Poslední synchronizace:{" "}
                  {messageDate(lastSync)}. Automaticky každou minutu, když je
                  Pošta otevřená.
                </p>
              )}
              <div className="mail-workspace" aria-busy={loading}>
                <div className="admin-mail-list mail-inbox">
                  {loading && !messages.length && (
                    <p role="status">Načítám poštu…</p>
                  )}
                  {!loading && !messages.length && (
                    <p className="admin-empty">
                      V této části nejsou načtené žádné odpovídající zprávy.
                    </p>
                  )}
                  {messages.map((message) => (
                    <button
                      type="button"
                      key={message.uid}
                      className={`${
                        selected?.uid === message.uid ? "selected " : ""
                      }${message.seen ? "" : "unread"}`}
                      disabled={loading}
                      onClick={() => void openMessage(message.uid)}
                    >
                      <span className="mail-peer">
                        {folder === "sent" ? message.to : message.from}
                      </span>
                      <strong>{message.subject}</strong>
                      <small>
                        {messageDate(message.date)}
                        {message.seen ? "" : " · Nepřečteno"}
                      </small>
                    </button>
                  ))}
                  {nextCursor && (
                    <button
                      className="admin-outline"
                      type="button"
                      disabled={loading}
                      onClick={() => void load(nextCursor)}
                    >
                      Načíst další zprávy
                    </button>
                  )}
                </div>
                {selected
                  ? (
                    <article className="admin-mail-message mail-detail">
                      <h3>{selected.subject}</h3>
                      <p>Od: {selected.from}</p>
                      <p>Komu: {selected.to}</p>
                      <p className="admin-small">
                        {messageDate(selected.date)}
                      </p>
                      <div className="mail-message-actions">
                        {folder === "inbox" && (
                          <button
                            className="admin-outline"
                            type="button"
                            disabled={!readConnected || sending}
                            onClick={reply}
                          >
                            Odpovědět
                          </button>
                        )}
                        <button
                          className="admin-outline"
                          type="button"
                          disabled={loading}
                          onClick={() => void seen()}
                        >
                          {selected.seen
                            ? "Označit jako nepřečtené"
                            : "Označit jako přečtené"}
                        </button>
                      </div>
                      <pre>{selected.text}</pre>
                      {selected.attachments?.map((item, index) => (
                        <p className="admin-small" key={index}>
                          Příloha: {item.name} · otevři v iCloud Mail.
                        </p>
                      ))}
                      {matched
                        ? (
                          <div className="mail-contact-card">
                            <strong>{matched.name}</strong>
                            <span>{matched.email}</span>
                            <button
                              type="button"
                              className="admin-outline"
                              onClick={onOpenContacts}
                            >
                              Otevřít kontakty
                            </button>
                            <button
                              type="button"
                              className="admin-outline"
                              onClick={() => setContact(matched.email)}
                            >
                              Zobrazit korespondenci kontaktu
                            </button>
                          </div>
                        )
                        : peer && (
                          <button
                            className="admin-outline"
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              setLoading(true);
                              void onAddContact(peer).then(() =>
                                setNotice("Kontakt byl uložen.")
                              ).catch((e) => setError(errorText(e))).finally(
                                () => setLoading(false),
                              );
                            }}
                          >
                            Uložit kontakt {peer}
                          </button>
                        )}
                    </article>
                  )
                  : (
                    <div className="mail-detail mail-placeholder">
                      <p>Vyber zprávu a zobraz její obsah.</p>
                    </div>
                  )}
              </div>
              <p className="admin-small">
                Zprávy zobrazujeme jako prostý text bez vzdálených obrázků.
                Úplnou HTML verzi a přílohy otevři v{" "}
                <a
                  href="https://www.icloud.com/mail/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  iCloud Mail ↗
                </a>.
              </p>
            </>
          )}
      </section>
      {compose && (
        <section className="admin-panel mail-compose">
          <div className="mail-heading">
            <h2>{inReplyTo ? "Odpověď" : "Nová zpráva"}</h2>
            <button
              type="button"
              className="admin-outline"
              disabled={sending}
              onClick={() => {
                if (!body || window.confirm("Zahodit rozepsanou zprávu?")) {
                  setCompose(false);
                  setBody("");
                }
              }}
            >
              Zavřít rozepsanou zprávu
            </button>
          </div>
          <p className="admin-small">
            Odesílatel: Adam Pruška &lt;{address}&gt;. Odesílání přes iCloud.
          </p>
          {!sendConnected && (
            <p className="admin-alert">
              Přímé odesílání čeká na připojení SMTP relay. Koncept můžeš uložit
              do iCloudu a odeslat tam.
            </p>
          )}
          <form onSubmit={send}>
            <label className="admin-field">
              <span>Komu</span>
              <input
                type="email"
                list="mail-contacts"
                value={to}
                required
                maxLength={254}
                disabled={sending || uncertain}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <datalist id="mail-contacts">
              {clients.map((client) => (
                <option key={client.id} value={client.email}>
                  {client.name}
                </option>
              ))}
            </datalist>
            {recipientContact && (
              <p className="admin-small">Kontakt: {recipientContact.name}</p>
            )}
            <label className="admin-field">
              <span>Předmět</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                maxLength={200}
                disabled={sending || uncertain}
              />
            </label>
            <label className="admin-field">
              <span>Zpráva</span>
              <textarea
                value={body}
                rows={10}
                maxLength={20000}
                required
                disabled={sending || uncertain}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              type="submit"
              disabled={!sendConnected || sending || uncertain}
            >
              {sending && !savingDraft ? "Odesílám…" : "Odeslat zprávu"}
            </button>
            <button
              className="admin-outline"
              type="button"
              disabled={!readConnected || sending || uncertain}
              onClick={(event) => void saveDraft(event.currentTarget.form)}
            >
              {savingDraft ? "Ukládám koncept…" : "Uložit koncept do iCloudu"}
            </button>
            <p className="admin-small">
              <a
                href="https://www.icloud.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Otevřít iCloud Mail ↗
              </a>
            </p>
            {uncertain && (
              <p className="admin-small">
                Další odeslání této zprávy je zablokované. Ověř výsledek v
                Odeslaných a přehledu odesílání. Novou zprávu založ teprve po
                této kontrole.
              </p>
            )}
          </form>
        </section>
      )}
      <section className="admin-panel">
        <div className="mail-heading">
          <h2>Přehled odesílání z administrace</h2>
          <button
            className="admin-outline"
            type="button"
            disabled={syncing || sending || !readConnected}
            onClick={() => void synchronize()}
          >
            {syncing ? "Synchronizuji…" : "Synchronizovat odeslané kopie"}
          </button>
        </div>
        <p className="admin-small">
          Odeslané v horní části obsahují i zprávy poslané přímo z iCloudu. Toto
          je stav operací z administrace; přijetí serverem nepotvrzuje doručení
          adresátovi.
        </p>
        {outbox.map((item) => (
          <div className="admin-list-row" key={item.id}>
            <div>
              <strong>{item.subject}</strong>
              <span>{item.recipient}</span>
            </div>
            <span className={`admin-badge status-${item.status}`}>
              {{
                sent: "Odesláno",
                sending: "Odesílání",
                uncertain: "Ověřit odeslání",
                failed: "Neodesláno",
              }[item.status] || item.status}
              {item.status === "sent" &&
                  ["icloud_smtp", "icloud_relay"].includes(
                    item.transport || "",
                  ) &&
                  !item.sent_copy_saved
                ? " · kopie čeká na synchronizaci"
                : ""}
            </span>
          </div>
        ))}
        {!outbox.length && (
          <p className="admin-empty">
            Z administrace zatím nebyla odeslána žádná zpráva.
          </p>
        )}
      </section>
    </>
  );
}
