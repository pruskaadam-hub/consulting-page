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
export function mailboxError(error: unknown) {
  if (error instanceof ApiError) return error;
  const detail = (error && typeof error === "object" ? error : {}) as {
    authenticationFailed?: boolean; serverResponseCode?: string; code?: string;
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
  return new ApiError("Načtení pošty selhalo při komunikaci IMAP. Zkontroluj protokoly funkce admin-api v Supabase; přihlašovací údaje neměň bez ověření příčiny.", 502);
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
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      if (uid) {
        const info = await client.fetchOne(uid, { size: true }, { uid: true });
        if (!info) throw new ApiError("Zpráva nebyla nalezena.", 404);
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
      const total = (client.mailbox && client.mailbox.exists) || 0;
      if (total) {
        for await (
          const message of client.fetch(
            `${Math.max(1, total - 24)}:*`,
            { envelope: true, flags: true },
          )
        ) {
          messages.push({
            uid: message.uid,
            subject: message.envelope?.subject || "(bez předmětu)",
            from: message.envelope?.from?.[0]?.address || "",
            date: message.envelope?.date
              ? new Date(message.envelope.date).toISOString()
              : "",
            seen: message.flags?.has("\\Seen") || false,
          });
        }
      }
      return { messages: messages.reverse(), limit: 25 };
    } finally {
      lock.release();
    }
  } catch (error) {
    throw mailboxError(error);
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
