import { type InboxReader, type MailFolder, NativeImap } from "./mail-imap.ts";
import {
  MAIL_ADDRESS,
  mailSource,
  SmtpFailure,
  submitSmtp,
} from "./mail-smtp.ts";
import nodemailer from "npm:nodemailer@10.1.1";
import PostalMime from "npm:postal-mime@4.0.5";
import { ApiError, mailInput } from "./contracts.mjs";
import { config, serviceClient } from "./auth.ts";
function settings() {
  const provider = config("MAIL_PROVIDER", false) || "icloud";
  if (provider !== "icloud" && provider !== "forpsi") {
    throw new ApiError("Neplatné nastavení poskytovatele pošty.", 503);
  }
  const username = config(
    provider === "icloud" ? "ICLOUD_USERNAME" : "FORPSI_USERNAME",
    false,
  );
  const password = config(
    provider === "icloud" ? "ICLOUD_APP_PASSWORD" : "FORPSI_PASSWORD",
    false,
  );
  const from = config("MAIL_FROM_EMAIL", false) ||
    (provider === "forpsi" ? username : "adam@adampruska.cz");
  const validFrom = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(from) &&
    from.length <= 254;
  return { provider, username, password, from, validFrom };
}
export function mailStatus() {
  const value = settings();
  const read = Boolean(value.username && value.password);
  const relay = Boolean(
    config("MAIL_RELAY_URL", false) && config("MAIL_RELAY_SECRET", false),
  );
  const send = value.provider === "icloud"
    ? config("MAIL_DELIVERY_PROVIDER", false) === "resend"
      ? Boolean(value.validFrom && config("RESEND_API_KEY", false))
      : read && (relay || config("ICLOUD_SMTP_DIRECT", false) === "true")
    : read;
  return {
    mail: read && send,
    mail_read: read,
    mail_send: send,
    mail_provider: value.provider,
    mailbox: value.provider === "icloud" ? MAIL_ADDRESS : value.from,
    mail_transport: value.provider === "icloud" &&
        config("MAIL_DELIVERY_PROVIDER", false) !== "resend"
      ? relay ? "icloud_relay" : "icloud_smtp"
      : "legacy",
  };
}
// Never forward provider diagnostics: they can contain mailbox data or credentials.
export function mailboxError(error: unknown, stage = "unknown") {
  if (error instanceof ApiError) return error;
  const detail = (error && typeof error === "object" ? error : {}) as {
    authenticationFailed?: boolean;
    serverResponseCode?: string;
    code?: string;
    name?: string;
    message?: string;
  };
  if (
    detail.authenticationFailed ||
    detail.serverResponseCode === "AUTHENTICATIONFAILED"
  ) {
    return new ApiError(
      "Poštovní server odmítl přihlášení. V Supabase Secrets zkontroluj ICLOUD_USERNAME: použij adresu iCloud Mail (např. pruskaadam@me.com), nikoli přihlášení Apple účtu na Yahoo. ICLOUD_APP_PASSWORD musí být heslo pro aplikaci vytvořené v účtu Apple.",
      502,
    );
  }
  if (
    [
      "ETIMEDOUT",
      "ETIMEOUT",
      "CONNECT_TIMEOUT",
      "GREETING_TIMEOUT",
      "SocketTimeout",
    ].includes(detail.code || "")
  ) {
    return new ApiError(
      "Vypršel čas spojení s poštovním serverem (IMAP přes TLS, port 993). Zkus načíst poštu později; tato chyba sama neznamená nesprávné heslo.",
      504,
    );
  }
  if (
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "EHOSTUNREACH",
      "ENETUNREACH",
    ].includes(detail.code || "")
  ) {
    return new ApiError(
      "Supabase se nemůže spojit s poštovním serverem na portu 993. Zkontroluj dostupnost iCloudu a síťové spojení; tato chyba sama neznamená nesprávné heslo.",
      502,
    );
  }
  if (detail.code === "ETHROTTLE") {
    return new ApiError(
      "Poštovní server dočasně omezil připojení. Před dalším načtením chvíli počkej.",
      503,
    );
  }
  const kinds = ["TypeError", "RangeError", "NotSupportedError", "Error"];
  const codes = [
    "ConnectionClosed",
    "NoConnection",
    "CommandFailed",
    "InvalidSequence",
    "InvalidSearchQuery",
    "UnexpectedClose",
    "ERR_STREAM_PREMATURE_CLOSE",
    "ERR_INVALID_ARG_TYPE",
    "ERR_NOT_IMPLEMENTED",
    "EPROTO",
    "ETLS",
  ];
  const kind = codes.includes(detail.code || "")
    ? detail.code
    : kinds.includes(detail.name || "")
    ? detail.name
    : "unknown";
  const hint = typeof detail.message === "string" &&
      /Invalid time value/.test(detail.message)
    ? "date"
    : typeof detail.message === "string" &&
        /not iterable/.test(detail.message)
    ? "iterable"
    : typeof detail.message === "string" &&
        /Cannot read properties of null/.test(detail.message)
    ? "null"
    : "other";
  const safeStage =
    ["connect", "inbox", "list", "detail", "unknown"].includes(stage)
      ? stage
      : "unknown";
  const diagnostic = `MAIL3/${safeStage}/${kind}/${hint}`;
  console.error("Mailbox operation failed", diagnostic);
  return new ApiError(
    `Načtení pošty selhalo. Diagnostický kód: ${diagnostic}. Přihlašovací údaje zatím neměň.`,
    502,
  );
}
const WEBSITE_MAILBOX = "adam@adampruska.cz";
function forWebsite(
  envelope?: {
    from?: { address?: string }[];
    to?: { address?: string }[];
    cc?: { address?: string }[];
  },
  folder: MailFolder = "inbox",
) {
  if (folder === "sent") {
    return envelope?.from?.some((item) =>
      item?.address?.toLowerCase() === WEBSITE_MAILBOX
    ) || false;
  }
  const recipients = [envelope?.to, envelope?.cc].flatMap((items) =>
    Array.isArray(items) ? items : []
  );
  return recipients.some((recipient) =>
    typeof recipient?.address === "string" &&
    recipient.address.trim().toLowerCase() === WEBSITE_MAILBOX
  );
}
function mailDate(value: unknown) {
  if (
    !value ||
    (typeof value !== "string" && typeof value !== "number" &&
      !(value instanceof Date))
  ) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
export async function readWebsiteMail(
  client: InboxReader,
  uid?: number,
  options: { folder?: MailFolder; cursor?: number; contact?: string } = {},
) {
  const folder = options.folder || "inbox";
  if (uid) {
    const info = await client.fetchOne(uid, { size: true, envelope: true }, {
      uid: true,
    });
    if (!info || !forWebsite(info.envelope, folder)) {
      throw new ApiError("Zpráva nebyla nalezena.", 404);
    }
    if ((info.size || 0) > 5_000_000) {
      throw new ApiError(
        "Tuto velkou zprávu otevři ve své poštovní aplikaci.",
        413,
      );
    }
    const message = await client.fetchOne(
      uid,
      { source: true },
      { uid: true },
    );
    if (!message || !message.source) {
      throw new ApiError("Zprávu se nepodařilo načíst.", 502);
    }
    const parsed = await PostalMime.parse(message.source);
    return {
      uid,
      folder,
      messageId: parsed.messageId || "",
      replyTo: parsed.replyTo?.find((item) => "address" in item)?.address ||
        parsed.from?.address || "",
      references: parsed.references || "",
      subject: parsed.subject || "(bez předmětu)",
      from: parsed.from?.address || "",
      to: parsed.to?.map((item) => item.address).join(", ") || "",
      date: parsed.date || "",
      text: parsed.text ||
        "Tato zpráva obsahuje pouze HTML. Otevři ji ve své poštovní aplikaci.",
      attachments: parsed.attachments.map((item) => ({
        name: item.filename || "Příloha",
        mime: item.mimeType,
      })),
    };
  }
  const messages = [];
  const total = client.mailbox ? client.mailbox.exists : 0;
  // Reuse the original working sequence FETCH, without recipient SEARCH.
  // Only matching envelopes leave the backend.
  let nextCursor: number | null = null;
  let scanned = 0;
  for (
    let end = Math.min(options.cursor || total, total);
    end > 0 && messages.length < 25 && scanned < 500;
    end -= 50
  ) {
    const batch = [];
    const start = Math.max(1, end - 49);
    const range = `${start}:${end}`;
    scanned += end - start + 1;
    nextCursor = start > 1 ? start - 1 : null;
    for await (
      const message of client.fetch(range, { envelope: true, flags: true })
    ) {
      if (!forWebsite(message.envelope, folder)) continue;
      const peers = folder === "inbox"
        ? message.envelope?.from
        : [...(message.envelope?.to || []), ...(message.envelope?.cc || [])];
      if (
        options.contact &&
        !peers?.some((item) => item.address?.toLowerCase() === options.contact)
      ) continue;
      batch.push({
        uid: message.uid,
        seq: message.seq,
        folder,
        to: message.envelope?.to?.map((item) =>
          item?.address
        ).filter(Boolean).join(", ") || "",
        subject: message.envelope?.subject || "(bez předmětu)",
        from: message.envelope?.from?.[0]?.address || "",
        date: mailDate(message.envelope?.date),
        seen: message.flags?.has("\\Seen") || false,
      });
    }
    messages.push(...batch.sort((a, b) => b.uid - a.uid));
  }
  const page = messages.slice(0, 25);
  if (messages.length > 25) {
    nextCursor = Math.max(0, page[page.length - 1].seq - 1) || null;
  }
  return { messages: page, limit: 25, nextCursor, folder };
}
export async function readMail(
  uid?: number,
  options: { folder?: MailFolder; cursor?: number; contact?: string } = {},
) {
  if (!mailStatus().mail_read) {
    throw new ApiError("Nejprve připoj schránku v Supabase Secrets.", 503);
  }
  const value = settings();
  let client: NativeImap | undefined;
  let stage = "connect";
  try {
    client = await NativeImap.open(
      value.username.trim(),
      value.password.trim(),
      undefined,
      value.provider === "icloud" ? "imap.mail.me.com" : "imap.forpsi.com",
    );
    stage = "inbox";
    await client.select(options.folder || "inbox");
    stage = uid ? "detail" : "list";
    return await readWebsiteMail(client, uid, options);
  } catch (error) {
    throw mailboxError(error, stage);
  } finally {
    client?.close();
  }
}
export async function sendMail(body: unknown) {
  if (
    settings().provider === "icloud" &&
    config("MAIL_DELIVERY_PROVIDER", false) !== "resend"
  ) {
    if (!mailStatus().mail_send) {
      throw new ApiError(
        "Přímé odesílání čeká na připojení SMTP relay. Koncept můžeš uložit do iCloudu a odeslat tam.",
        503,
      );
    }
    return sendIcloudMail(body);
  }
  return sendLegacyMail(body);
}
export async function deliverIcloud(
  username: string,
  password: string,
  message: Parameters<typeof submitSmtp>[2],
  source: Uint8Array,
) {
  const relay = config("MAIL_RELAY_URL", false),
    key = config("MAIL_RELAY_SECRET", false);
  if (relay && key) {
    let endpoint: URL;
    try {
      endpoint = new URL(relay);
      if (
        endpoint.protocol !== "https:" || endpoint.username ||
        endpoint.password || endpoint.search || endpoint.hash
      ) throw new Error();
      endpoint.pathname = endpoint.pathname.replace(/\/$/, "") + "/send";
    } catch {
      throw new SmtpFailure(
        "Zkontroluj HTTPS adresu SMTP relay v Supabase Secrets.",
        false,
      );
    }
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(45000),
        redirect: "error",
      });
    } catch {
      throw new SmtpFailure(
        "Spojení s SMTP relay bylo přerušeno. Ověř odeslání před dalším pokusem.",
        true,
      );
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== "sent") {
      throw new SmtpFailure(
        response.status === 401
          ? "SMTP relay odmítla přístup. Zkontroluj sdílený klíč."
          : "SMTP relay nepotvrdila odeslání. Ověř přehled a Odeslané.",
        response.status === 401 ? false : result?.uncertain !== false,
      );
    }
    return;
  }
  if (config("ICLOUD_SMTP_DIRECT", false) !== "true") {
    throw new SmtpFailure(
      "Přímé odesílání čeká na připojení SMTP relay. Koncept můžeš uložit do iCloudu a odeslat tam.",
      false,
    );
  }
  return submitSmtp(username, password, message, source);
}
export async function sendIcloudMail(
  body: unknown,
  dependencies = { submit: deliverIcloud, open: NativeImap.open },
) {
  const message = mailInput(body);
  const value = settings();
  if (!value.username || !value.password) {
    throw new ApiError("Připoj iCloud v Supabase Secrets.", 503);
  }
  const source = mailSource(message);
  const db = serviceClient();
  const claim = await db.from("mail_outbox").insert({
    id: message.id,
    recipient: message.to,
    subject: message.subject,
    status: "sending",
    message_id: `<${message.id}@adampruska.cz>`,
    transport: config("MAIL_RELAY_URL", false) ? "icloud_relay" : "icloud_smtp",
    source: new TextDecoder().decode(source),
  });
  if (claim.error) {
    throw new ApiError(
      "Tato zpráva už byla předána k odeslání. Zkontroluj Odeslané a přehled odesílání.",
      409,
    );
  }
  try {
    await dependencies.submit(
      value.username.trim(),
      value.password.trim(),
      message,
      source,
    );
  } catch (error) {
    const uncertain = !(error instanceof SmtpFailure) || error.uncertain;
    await db.from("mail_outbox").update({
      status: uncertain ? "uncertain" : "failed",
      source: uncertain ? new TextDecoder().decode(source) : null,
    }).eq("id", message.id);
    throw new ApiError(
      error instanceof SmtpFailure
        ? error.message
        : "Výsledek odeslání není jistý. Před dalším pokusem zkontroluj Odeslané.",
      502,
    );
  }
  // SMTP 250 is final: a subsequent IMAP/DB failure must never cause a second send.
  const saved = await db.from("mail_outbox").update({ status: "sent" }).eq(
    "id",
    message.id,
  );
  let client: NativeImap | undefined;
  try {
    client = await dependencies.open(
      value.username.trim(),
      value.password.trim(),
    );
    if (!await client.hasSent(`<${message.id}@adampruska.cz>`)) {
      await client.appendSent(source);
    }
    const synced = await db.from("mail_outbox").update({
      status: "sent",
      sent_copy_saved: true,
      source: null,
    }).eq("id", message.id);
    if (synced.error) {
      return {
        status: "sent",
        warning:
          "Zpráva byla odeslána a uložena v iCloudu. Aktualizace přehledu odesílání selhala.",
      };
    }
    return { status: "sent" };
  } catch {
    return {
      status: "sent",
      warning: saved.error
        ? "Zpráva byla odeslána, ale uložení stavu a kopie v iCloudu se nepodařilo potvrdit. Neodesílej ji znovu."
        : "Zpráva byla odeslána. Kopii do iCloud Odeslaných doplníš tlačítkem Synchronizovat odeslané kopie; zprávu znovu neposílej.",
    };
  } finally {
    client?.close();
  }
}
export async function syncSentCopies() {
  const db = serviceClient();
  const result = await db.from("mail_outbox").select("id,message_id,source").eq(
    "status",
    "sent",
  ).eq("sent_copy_saved", false).in("transport", [
    "icloud_smtp",
    "icloud_relay",
  ]).not("source", "is", null).limit(10);
  if (result.error) {
    throw new ApiError("Frontu odeslaných kopií se nepodařilo načíst.", 502);
  }
  if (!result.data?.length) return { synced: 0 };
  const value = settings();
  const client = await NativeImap.open(
    value.username.trim(),
    value.password.trim(),
  );
  let synced = 0;
  try {
    for (const item of result.data) {
      if (!await client.hasSent(item.message_id)) {
        await client.appendSent(new TextEncoder().encode(item.source));
      }
      const saved = await db.from("mail_outbox").update({
        sent_copy_saved: true,
        source: null,
      }).eq("id", item.id);
      if (saved.error) {
        throw new ApiError(
          "Kopie je v iCloudu, ale stav se nepodařilo uložit.",
          502,
        );
      }
      synced++;
    }
    return { synced };
  } finally {
    client.close();
  }
}
async function sendLegacyMail(body: unknown) {
  const message = mailInput(body);
  if (!mailStatus().mail_send) {
    throw new ApiError(
      "Nejprve nastav odesílání pošty v Supabase Secrets.",
      503,
    );
  }
  const value = settings();
  const db = serviceClient();
  // Claim before contacting SMTP. An uncertain response must never cause automatic resend.
  const claim = await db
    .from("mail_outbox")
    .insert({
      id: message.id,
      recipient: message.to,
      subject: message.subject,
      status: "sending",
    });
  if (claim.error) {
    throw new ApiError(
      "Tato zpráva už byla odeslána nebo se odesílá. Před dalším pokusem zkontroluj stav.",
      409,
    );
  }
  const transport = value.provider === "forpsi"
    ? nodemailer.createTransport({
      host: "smtp.forpsi.com",
      port: 465,
      secure: true,
      auth: { user: value.username, pass: value.password },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    })
    : null;
  try {
    let messageId: string;
    if (transport) {
      const result = await transport.sendMail({
        from: { name: "Adam Pruška", address: value.from },
        to: message.to,
        subject: message.subject,
        text: message.text,
        messageId: `<${message.id}@adampruska.cz>`,
      });
      if (!result.accepted?.length) {
        throw new Error("SMTP did not accept the message");
      }
      messageId = result.messageId;
    } else {
      // iCloud SMTP uses port 587, blocked in hosted Supabase Edge Functions.
      // Resend HTTPS delivers from the verified domain; replies go to iCloud.
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `mail/${message.id}`,
        },
        body: JSON.stringify({
          from: `Adam Pruška <${value.from}>`,
          reply_to: value.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Mail provider rejected the message");
      }
      const result = await response.json();
      if (
        typeof result.id !== "string" || !result.id || result.id.length > 200
      ) {
        throw new Error("Mail provider did not return a message ID");
      }
      messageId = result.id;
    }
    const saved = await db
      .from("mail_outbox")
      .update({ status: "sent", message_id: messageId })
      .eq("id", message.id);
    if (saved.error) {
      return {
        status: "sent",
        warning:
          "Zpráva byla odeslána, ale stav v přehledu se nepodařilo uložit.",
      };
    }
    return { status: "sent" };
  } catch {
    await db
      .from("mail_outbox")
      .update({ status: "uncertain" })
      .eq("id", message.id);
    throw new ApiError(
      "Výsledek odeslání není jistý. Neodesílej znovu bez kontroly pošty.",
      502,
    );
  } finally {
    transport?.close();
  }
}

export async function setMailSeen(
  uid: number,
  folder: MailFolder,
  seen: boolean,
) {
  const value = settings();
  const client = await NativeImap.open(
    value.username.trim(),
    value.password.trim(),
  );
  try {
    await client.select(folder, false);
    const row = await client.fetchOne(uid, { envelope: true }, { uid: true });
    if (!row || !forWebsite(row.envelope, folder)) {
      throw new ApiError("Zpráva nebyla nalezena.", 404);
    }
    await client.command(
      `UID STORE ${uid} ${seen ? "+" : "-"}FLAGS.SILENT (\\Seen)`,
      "seen",
    );
    return { seen };
  } finally {
    client.close();
  }
}

export async function saveMailDraft(body: unknown) {
  const message = mailInput(body),
    source = mailSource(message),
    value = settings();
  if (!mailStatus().mail_read) {
    throw new ApiError("Připoj iCloud v Supabase Secrets.", 503);
  }
  const client = await NativeImap.open(
    value.username.trim(),
    value.password.trim(),
  );
  try {
    if (!await client.hasMessage(`<${message.id}@adampruska.cz>`, "drafts")) {
      await client.appendTo("drafts", source);
    }
    return { saved: true };
  } finally {
    client.close();
  }
}
