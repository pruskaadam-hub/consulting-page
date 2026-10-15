import { ImapFlow } from "npm:imapflow@2.4.0";
import nodemailer from "npm:nodemailer@10.1.1";
import PostalMime from "npm:postal-mime@4.0.5";
import { ApiError, mailInput } from "./contracts.mjs";
import { config, serviceClient } from "./auth.ts";
export function mailConfigured() {
  return Boolean(
    config("FORPSI_USERNAME", false) && config("FORPSI_PASSWORD", false),
  );
}
export async function readMail(uid?: number) {
  const client = new ImapFlow({
    host: "imap.forpsi.com",
    port: 993,
    secure: true,
    auth: { user: config("FORPSI_USERNAME"), pass: config("FORPSI_PASSWORD") },
    logger: false,
    connectionTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (uid) {
        const info = await client.fetchOne(uid, { size: true }, { uid: true });
        if (!info) throw new ApiError("Zpráva nebyla nalezena.", 404);
        if ((info.size || 0) > 5_000_000)
          throw new ApiError(
            "Tuto velkou zprávu otevři ve webmailu FORPSI.",
            413,
          );
        const message = await client.fetchOne(
          uid,
          { source: true },
          { uid: true },
        );
        if (!message || !message.source)
          throw new ApiError("Zprávu se nepodařilo načíst.", 502);
        const parsed = await PostalMime.parse(message.source);
        return {
          uid,
          subject: parsed.subject || "(bez předmětu)",
          from: parsed.from?.address || "",
          to: parsed.to?.map((item) => item.address).join(", ") || "",
          date: parsed.date || "",
          text:
            parsed.text ||
            "Tato zpráva obsahuje pouze HTML. Otevři ji ve webmailu FORPSI.",
          attachments: parsed.attachments.map((item) => ({
            name: item.filename || "Příloha",
            mime: item.mimeType,
          })),
        };
      }
      const messages = [];
      const total = (client.mailbox && client.mailbox.exists) || 0;
      if (total)
        for await (const message of client.fetch(
          `${Math.max(1, total - 24)}:*`,
          { envelope: true, flags: true },
        )) {
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
      return { messages: messages.reverse(), limit: 25 };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
export async function sendMail(body: unknown) {
  const message = mailInput(body);
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
  if (claim.error)
    throw new ApiError(
      "Tato zpráva už byla odeslána nebo se odesílá. Před dalším pokusem zkontroluj stav.",
      409,
    );
  const transport = nodemailer.createTransport({
    host: "smtp.forpsi.com",
    port: 465,
    secure: true,
    auth: { user: config("FORPSI_USERNAME"), pass: config("FORPSI_PASSWORD") },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "Adam Pruška", address: config("FORPSI_USERNAME") },
      to: message.to,
      subject: message.subject,
      text: message.text,
      messageId: `<${message.id}@adampruska.cz>`,
    });
    if (!result.accepted?.length)
      throw new Error("SMTP did not accept the message");
    const saved = await db
      .from("mail_outbox")
      .update({ status: "sent", message_id: result.messageId })
      .eq("id", message.id);
    if (saved.error)
      return {
        status: "sent",
        warning:
          "Zpráva byla odeslána, ale stav v přehledu se nepodařilo uložit.",
      };
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
    transport.close();
  }
}
