import { ApiError } from "./contracts.mjs";
import {
  connectMail,
  mailBase64,
  type MailConnector,
  type MailWire,
} from "./mail-wire.ts";
export type OutgoingMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
};
export const MAIL_ADDRESS = "adam@adampruska.cz";
function encodedHeader(value: string) {
  const chunks: string[] = [];
  let chunk = "";
  for (const char of value) {
    if (new TextEncoder().encode(chunk + char).length > 42) {
      chunks.push(`=?UTF-8?B?${mailBase64(chunk)}?=`);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) chunks.push(`=?UTF-8?B?${mailBase64(chunk)}?=`);
  return chunks.join("\r\n ");
}
export function mailSource(message: OutgoingMessage) {
  const headers = [
    `From: ${encodedHeader("Adam Pruška")} <${MAIL_ADDRESS}>`,
    `To: <${message.to}>`,
    `Reply-To: <${MAIL_ADDRESS}>`,
    `Subject: ${encodedHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${message.id}@adampruska.cz>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (message.inReplyTo) headers.push(`In-Reply-To: ${message.inReplyTo}`);
  if (message.references) headers.push(`References: ${message.references}`);
  const body =
    mailBase64(message.text.replace(/\r?\n/g, "\r\n")).match(/.{1,76}/g)?.join(
      "\r\n",
    ) || "";
  return new TextEncoder().encode(
    headers.join("\r\n") + "\r\n\r\n" + body + "\r\n",
  );
}
export class SmtpFailure extends ApiError {
  constructor(
    message: string,
    public uncertain: boolean,
    public definiteRefusal = false,
  ) {
    super(message, 502);
  }
}
async function reply(wire: MailWire, expected: number[]) {
  let code = 0;
  for (let i = 0; i < 100; i++) {
    const line = await wire.line();
    const match = line.match(/^(\d{3})([- ])(.*)$/);
    if (!match) {
      throw new SmtpFailure("SMTP server poslal neplatnou odpověď.", false);
    }
    if (code && code !== Number(match[1])) {
      throw new SmtpFailure("SMTP server poslal neplatnou odpověď.", false);
    }
    code = Number(match[1]);
    if (match[2] === " ") {
      if (!expected.includes(code)) {
        throw new SmtpFailure(
          code === 535
            ? "iCloud odmítl SMTP přihlášení. Zkontroluj heslo pro aplikaci."
            : `iCloud odmítl odeslání (SMTP ${code}).`,
          false,
          true,
        );
      }
      return;
    }
  }
  throw new SmtpFailure("SMTP odpověď překročila limit.", false);
}
export async function submitSmtp(
  username: string,
  password: string,
  message: OutgoingMessage,
  source: Uint8Array,
  connector: MailConnector = connectMail,
  hostname = "smtp.mail.me.com",
) {
  let wire: MailWire | undefined;
  let dataStarted = false;
  let accepted = false;
  try {
    wire = await connector(hostname, 465);
    await reply(wire, [220]);
    await wire.write("EHLO adampruska.cz\r\n");
    await reply(wire, [250]);
    await wire.write(
      `AUTH PLAIN ${mailBase64("\0" + username + "\0" + password)}\r\n`,
    );
    await reply(wire, [235]);
    await wire.write(`MAIL FROM:<${MAIL_ADDRESS}>\r\n`);
    await reply(wire, [250]);
    await wire.write(`RCPT TO:<${message.to}>\r\n`);
    await reply(wire, [250, 251]);
    await wire.write("DATA\r\n");
    await reply(wire, [354]);
    dataStarted = true;
    // Body is base64, so no line can begin with a dot. All headers are generated locally.
    await wire.write(source);
    await wire.write(".\r\n");
    try {
      await reply(wire, [250]);
    } catch (error) {
      if (error instanceof SmtpFailure && error.definiteRefusal) {
        dataStarted = false;
        throw error;
      }
      throw error;
    }
    accepted = true;
    // A failure during QUIT cannot undo the already acknowledged delivery.
    await wire.write("QUIT\r\n").catch(() => {});
  } catch (error) {
    if (accepted) return;
    if (error instanceof SmtpFailure) {
      throw new SmtpFailure(
        error.message,
        dataStarted && !error.definiteRefusal,
      );
    }
    throw new SmtpFailure(
      dataStarted
        ? "Výsledek odeslání není jistý. Neodesílej zprávu znovu bez kontroly Odeslaných."
        : "Spojení s iCloud SMTP se nezdařilo. Zpráva nebyla předána k odeslání.",
      dataStarted,
    );
  } finally {
    wire?.close();
  }
}

export async function verifySmtpLogin(
  username: string,
  password: string,
  connector: MailConnector = connectMail,
) {
  const wire = await connector("smtp.mail.me.com", 465);
  try {
    await reply(wire, [220]);
    await wire.write("EHLO adampruska.cz\r\n");
    await reply(wire, [250]);
    await wire.write(
      `AUTH PLAIN ${mailBase64("\0" + username + "\0" + password)}\r\n`,
    );
    await reply(wire, [235]);
    await wire.write("QUIT\r\n");
    return true;
  } finally {
    wire.close();
  }
}
