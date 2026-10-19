import { ImapFlow } from "npm:imapflow@2.4.0";
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
  const send = Boolean(
    value.validFrom &&
      (value.provider === "icloud" ? config("RESEND_API_KEY", false) : read),
  );
  return {
    mail: read && send,
    mail_read: read,
    mail_send: send,
    mail_provider: value.provider,
    mailbox: value.from || "adam@adampruska.cz",
  };
}
// Never forward provider diagnostics: they can contain mailbox data or credentials.
export function mailboxError(error: unknown, stage = "unknown") {
  if (error instanceof ApiError) return error;
  const detail = (error && typeof error === "object" ? error : {}) as {
    authenticationFailed?: boolean; serverResponseCode?: string; code?: string; name?: string; message?: string;
  };
  if (detail.authenticationFailed || detail.serverResponseCode === "AUTHENTICATIONFAILED") {
    return new ApiError("Poštovní server odmítl přihlášení. V Supabase Secrets zkontroluj ICLOUD_USERNAME: použij adresu iCloud Mail (např. pruskaadam@me.com), nikoli přihlášení Apple účtu na Yahoo. ICLOUD_APP_PASSWORD musí být heslo pro aplikaci vytvořené v účtu Apple.", 502);
  }
  if (["ETIMEDOUT", "ETIMEOUT", "CONNECT_TIMEOUT", "GREETING_TIMEOUT", "SocketTimeout"].includes(detail.code || "")) {
    return new ApiError("Vypršel čas spojení s poštovním serverem (IMAP přes TLS, port 993). Zkus načíst poštu později; tato chyba sama neznamená nesprávné heslo.", 504);
  }
  if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"].includes(detail.code || "")) {
    return new ApiError("Supabase se nemůže spojit s poštovním serverem na portu 993. Zkontroluj dostupnost iCloudu a síťové spojení; tato chyba sama neznamená nesprávné heslo.", 502);
  }
  if (detail.code === "ETHROTTLE") {
    return new ApiError("Poštovní server dočasně omezil připojení. Před dalším načtením chvíli počkej.", 503);
  }
  const kinds = ["TypeError", "RangeError", "NotSupportedError", "Error"];
  const codes = ["ConnectionClosed", "NoConnection", "CommandFailed", "InvalidSequence", "InvalidSearchQuery", "UnexpectedClose", "ERR_STREAM_PREMATURE_CLOSE", "ERR_INVALID_ARG_TYPE", "ERR_NOT_IMPLEMENTED", "EPROTO", "ETLS"];
  const kind = codes.includes(detail.code || "") ? detail.code : kinds.includes(detail.name || "") ? detail.name : "unknown";
  const hint = typeof detail.message === "string" && /Invalid time value/.test(detail.message) ? "date" : typeof detail.message === "string" && /not iterable/.test(detail.message) ? "iterable" : typeof detail.message === "string" && /Cannot read properties of null/.test(detail.message) ? "null" : "other";
  const safeStage = ["connect", "inbox", "list", "detail", "unknown"].includes(stage) ? stage : "unknown";
  const diagnostic = `MAIL3/${safeStage}/${kind}/${hint}`;
  console.error("Mailbox operation failed", diagnostic);
  return new ApiError(`Načtení pošty selhalo. Diagnostický kód: ${diagnostic}. Přihlašovací údaje zatím neměň.`, 502);
}
const WEBSITE_MAILBOX = "adam@adampruska.cz";
function forWebsite(envelope?: { to?: { address?: string }[]; cc?: { address?: string }[] }) {
  const recipients = [envelope?.to, envelope?.cc].flatMap(items => Array.isArray(items) ? items : []);
  return recipients.some(recipient => typeof recipient?.address === "string" && recipient.address.trim().toLowerCase() === WEBSITE_MAILBOX);
}
function mailDate(value: unknown) {
  if (!value || (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date))) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
export async function readWebsiteMail(client: Pick<ImapFlow, "mailbox" | "fetch" | "fetchOne">, uid?: number) {
      if (uid) {
        const info = await client.fetchOne(uid, { size: true, envelope: true }, { uid: true });
        if (!info || !forWebsite(info.envelope)) throw new ApiError("Zpráva nebyla nalezena.", 404);
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
      for (let end = total; end > 0 && messages.length < 25; end -= 100) {
        const batch = [];
        const range = `${Math.max(1, end - 99)}:${end}`;
        for await (const message of client.fetch(range, { envelope: true, flags: true })) {
          if (!forWebsite(message.envelope)) continue;
          batch.push({
            uid: message.uid,
            subject: message.envelope?.subject || "(bez předmětu)",
            from: message.envelope?.from?.[0]?.address || "",
            date: mailDate(message.envelope?.date),
            seen: message.flags?.has("\\Seen") || false,
          });
        }
        messages.push(...batch.sort((a, b) => b.uid - a.uid));
      }
      return { messages: messages.slice(0, 25), limit: 25 };
}
export async function readMail(uid?: number) {
  if (!mailStatus().mail_read) {
    throw new ApiError("Nejprve připoj schránku v Supabase Secrets.", 503);
  }
  const value = settings();
  const client = new ImapFlow({
    host: value.provider === "icloud" ? "imap.mail.me.com" : "imap.forpsi.com",
    port: 993,
    secure: true,
    auth: { user: value.username, pass: value.password },
    logger: false,
    connectionTimeout: 15000,
    socketTimeout: 20000,
  });
  client.on("error", () => {}); // Connection failures are handled by the awaited operations.
  let stage = "connect";
  try {
    await client.connect();
    stage = "inbox";
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      stage = uid ? "detail" : "list";
      return await readWebsiteMail(client, uid);
    } finally {
      lock.release();
    }
  } catch (error) {
    throw mailboxError(error, stage);
  } finally {
    await client.logout().catch(() => {});
  }
}
export async function sendMail(body: unknown) {
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
