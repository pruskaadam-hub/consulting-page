import PostalMime from "npm:postal-mime@4.0.5";
import { ApiError } from "./contracts.mjs";
import {
  connectMail,
  imapQuote,
  type MailConnector,
  type MailWire,
} from "./mail-wire.ts";
export type MailFolder = "inbox" | "sent";
type Row = { line: string; literal?: Uint8Array };
export type MailEnvelope = {
  subject?: string;
  from?: { address?: string }[];
  to?: { address?: string }[];
  cc?: { address?: string }[];
  date?: string;
  messageId?: string;
  replyTo?: { address?: string }[];
};
export type MailRow = {
  uid: number;
  seq: number;
  size?: number;
  envelope?: MailEnvelope;
  flags?: Set<string>;
  source?: Uint8Array;
};
export interface InboxReader {
  mailbox: { exists: number; uidValidity?: string } | false;
  fetch(
    range: string,
    query: { source?: boolean; envelope?: boolean; flags?: boolean },
    options?: { uid?: boolean },
  ): AsyncGenerator<MailRow>;
  fetchOne(
    uid: number,
    query: { size?: boolean; envelope?: boolean; source?: boolean },
    options?: { uid?: boolean },
  ): Promise<MailRow | false>;
}
export class NativeImap implements InboxReader {
  mailbox: { exists: number; uidValidity?: string } | false = false;
  private counter = 0;
  private constructor(private wire: MailWire) {}
  static async open(
    username: string,
    password: string,
    connector: MailConnector = connectMail,
    host = "imap.mail.me.com",
  ) {
    const wire = await connector(host, 993);
    const client = new NativeImap(wire);
    try {
      if (!/^\* OK\b/i.test(await wire.line())) {
        throw new ApiError("IMAP server nepřijal spojení.", 502);
      }
      await client.command(
        `LOGIN ${imapQuote(username)} ${imapQuote(password)}`,
        "auth",
      );
      return client;
    } catch (error) {
      wire.close();
      throw error;
    }
  }
  close() {
    this.wire.close();
  }
  async command(command: string, context = "imap"): Promise<Row[]> {
    const tag = `A${++this.counter}`;
    await this.wire.write(`${tag} ${command}\r\n`);
    const rows: Row[] = [];
    let size = 0;
    while (true) {
      const line = await this.wire.line();
      size += line.length;
      if (line.startsWith(tag + " ")) {
        if (!new RegExp(`^${tag} OK\\b`, "i").test(line)) {
          if (context === "auth") {
            throw new ApiError(
              "iCloud odmítl přihlášení. Zkontroluj adresu iCloud Mail a heslo pro aplikaci v Supabase Secrets.",
              502,
            );
          }
          throw new ApiError(
            `iCloud odmítl operaci ${context}. Diagnostický kód: MAIL4/${context}/refused.`,
            502,
          );
        }
        return rows;
      }
      if (/^\* BYE\b/i.test(line)) {
        throw new ApiError(
          "iCloud ukončil poštovní spojení. Zkus synchronizaci později.",
          502,
        );
      }
      const literal = line.match(/\{(\d+)\+?\}$/);
      const row: Row = { line };
      if (literal) {
        const length = Number(literal[1]);
        size += length;
        if (size > 8_000_000) {
          throw new ApiError("Poštovní odpověď je příliš velká.", 413);
        }
        row.literal = await this.wire.bytes(length);
      }
      rows.push(row);
      if (rows.length > 10000 || size > 8_000_000) {
        throw new ApiError("Poštovní odpověď překročila bezpečný limit.", 413);
      }
    }
  }
  async folderPath(folder: MailFolder | "drafts") {
    if (folder === "inbox") return "INBOX";
    const rows = await this.command('LIST "" "*"', "folders");
    const boxes = rows.filter((row) => /^\* LIST\b/i.test(row.line)).map(
      (row) => {
        const tail =
          row.line.match(/\)\s+(?:"(?:\\.|[^"])*"|NIL)\s+(.+)$/i)?.[1] || "";
        const path = row.literal
          ? new TextDecoder().decode(row.literal)
          : tail.startsWith('"')
          ? tail.slice(1, -1).replace(/\\(["\\])/g, "$1")
          : tail;
        return {
          path,
          sent: folder === "drafts"
            ? /\(.*\\Drafts\b/i.test(row.line)
            : /\(.*\\Sent\b/i.test(row.line),
        };
      },
    );
    const fallback = folder === "drafts"
      ? /^(Drafts|Draft Messages|INBOX[/.]Drafts)$/i
      : /^(Sent Messages|Sent|INBOX[/.]Sent|INBOX[/.]Sent Messages)$/i;
    const sent = boxes.find((box) => box.sent) ||
      boxes.find((box) => fallback.test(box.path));
    if (!sent?.path) {
      throw new ApiError(
        `Složka ${
          folder === "drafts" ? "Koncepty" : "Odeslané"
        } nebyla v iCloudu nalezena. Otevři iCloud Mail a zkontroluj složky.`,
        503,
      );
    }
    return sent.path;
  }
  async select(folder: MailFolder, readOnly = true) {
    const path = await this.folderPath(folder);
    const rows = await this.command(
      `${readOnly ? "EXAMINE" : "SELECT"} ${imapQuote(path)}`,
      "folder",
    );
    this.mailbox = {
      exists: Number(
        rows.map((row) => row.line.match(/^\* (\d+) EXISTS$/i)?.[1]).find(
          Boolean,
        ) || 0,
      ),
      uidValidity: rows.map((row) =>
        row.line.match(/\[UIDVALIDITY (\d+)\]/i)?.[1]
      ).find(Boolean),
    };
    return path;
  }
  async *fetch(
    range: string,
    query: { source?: boolean; envelope?: boolean; flags?: boolean },
    options?: { uid?: boolean },
  ): AsyncGenerator<MailRow> {
    if (!/^[1-9]\d*(?::(?:[1-9]\d*|\*))?$/.test(range)) {
      throw new ApiError("Neplatný rozsah zpráv.");
    }
    const body = query.source
      ? "BODY.PEEK[]"
      : query.envelope
      ? "BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID REPLY-TO IN-REPLY-TO REFERENCES)]"
      : "";
    const rows = await this.command(
      `${
        options?.uid ? "UID " : ""
      }FETCH ${range} (UID RFC822.SIZE FLAGS ${body})`,
      "fetch",
    );
    let active: { line: string; literal?: Uint8Array } | undefined;
    const complete = [];
    for (const row of rows) {
      if (/^\* \d+ FETCH\b/i.test(row.line)) {
        if (active) complete.push(active);
        active = { ...row };
      } else if (active) {
        active.line += " " + row.line;
        if (row.literal) active.literal = row.literal;
      }
    }
    if (active) complete.push(active);
    for (const row of complete) {
      const uid = Number(row.line.match(/\bUID (\d+)\b/i)?.[1]);
      if (!Number.isSafeInteger(uid) || uid <= 0) continue;
      const result: MailRow = {
        uid,
        seq: Number(row.line.match(/^\* (\d+)/)?.[1]),
        size: Number(row.line.match(/\bRFC822.SIZE (\d+)\b/i)?.[1] || 0),
        flags: new Set(
          (row.line.match(/\bFLAGS \(([^)]*)\)/i)?.[1] || "").split(/\s+/),
        ),
      };
      if (query.source) result.source = row.literal;
      else if (query.envelope && row.literal) {
        const parsed = await PostalMime.parse(row.literal);
        const addresses = (items: typeof parsed.to): { address?: string }[] =>
          (items || []).flatMap((item) =>
            "group" in item ? item.group || [] : [item]
          );
        result.envelope = {
          subject: parsed.subject,
          from: parsed.from ? [parsed.from] : [],
          to: addresses(parsed.to),
          cc: addresses(parsed.cc),
          date: parsed.date,
          messageId: parsed.messageId,
          replyTo: addresses(parsed.replyTo),
        };
      }
      yield result;
    }
  }
  async fetchOne(
    uid: number,
    query: { size?: boolean; envelope?: boolean; source?: boolean },
    options?: { uid?: boolean },
  ) {
    for await (const row of this.fetch(String(uid), query, options)) return row;
    return false;
  }
  async appendSent(source: Uint8Array) {
    return this.appendTo("sent", source);
  }
  async appendTo(folder: "sent" | "drafts", source: Uint8Array) {
    const path = await this.folderPath(folder);
    const tag = `A${++this.counter}`;
    await this.wire.write(
      `${tag} APPEND ${imapQuote(path)} (${
        folder === "drafts" ? "\\Draft \\Seen" : "\\Seen"
      }) {${source.length}}\r\n`,
    );
    let continuation = false;
    for (let i = 0; i < 20; i++) {
      const line = await this.wire.line();
      if (line.startsWith("+")) {
        continuation = true;
        break;
      }
      if (line.startsWith(tag + " ") || /^\* BYE\b/.test(line)) break;
    }
    if (!continuation) {
      throw new ApiError(
        "Zpráva byla odeslána, ale iCloud nepřijal kopii do Odeslaných.",
        502,
      );
    }
    await this.wire.write(source);
    await this.wire.write("\r\n");
    for (let i = 0; i < 100; i++) {
      const line = await this.wire.line();
      if (line.startsWith(tag + " ")) {
        if (!new RegExp(`^${tag} OK\\b`, "i").test(line)) {
          throw new ApiError("Kopii se nepodařilo uložit do Odeslaných.", 502);
        }
        return;
      }
    }
    throw new ApiError(
      "Uložení kopie do Odeslaných se nepodařilo ověřit.",
      502,
    );
  }
  async hasSent(messageId: string) {
    return this.hasMessage(messageId, "sent");
  }
  async hasMessage(messageId: string, folder: "sent" | "drafts") {
    if (!/^<[A-Za-z0-9._@-]+>$/.test(messageId)) return false;
    const path = await this.folderPath(folder);
    await this.command(`EXAMINE ${imapQuote(path)}`, "folder");
    const rows = await this.command(
      `UID SEARCH HEADER Message-ID ${imapQuote(messageId)}`,
      "sent-copy",
    );
    return rows.some((row) => /^\* SEARCH\s+[1-9]/.test(row.line));
  }
}
