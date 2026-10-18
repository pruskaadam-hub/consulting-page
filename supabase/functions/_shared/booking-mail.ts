import { config } from "./auth.ts";
import { mailStatus, sendMail } from "./mail.ts";
const sender = "adam@adampruska.cz";
export function safeMeetingUrl(booking: any) {
  const raw = booking?.meetingUrl || booking?.location;
  if (typeof raw !== "string") return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function bookingMailText(
  booking: any,
  cancellationToken: string,
  language = "cs",
) {
  const locale = language === "en"
    ? "en-GB"
    : language === "sk"
    ? "sk-SK"
    : "cs-CZ";
  const zone = booking.attendees?.[0]?.timeZone || "Europe/Prague";
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(booking.start));
  const base = new URL(config("SITE_URL", false) || "https://adampruska.cz/");
  if (!["https:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("Invalid public site URL");
  }
  if (language !== "cs") {
    base.pathname = base.pathname.replace(/\/?$/, "/") + language + "/";
  }
  base.search = "?sprava-rezervace";
  base.hash = cancellationToken;
  const meeting = safeMeetingUrl(booking),
    pending = String(booking.status).toLowerCase() === "pending";
  const t = language === "en"
    ? {
      confirmed: "Your consultation is confirmed",
      pending: "Your consultation is awaiting approval",
      time: "When",
      meeting: "Join the online meeting",
      waiting: "The meeting link is not available yet. Contact me at " +
        sender + ".",
      manage: "Manage / cancel your booking",
      policy:
        "Either of us can cancel up to 24 hours before the meeting starts. Opening the link alone does not cancel the booking.",
      payment:
        "Paid services are paid by bank transfer after an invoice is issued.",
      reply: "For questions or rescheduling, reply to this email.",
    }
    : language === "sk"
    ? {
      confirmed: "Konzultácia je potvrdená",
      pending: "Konzultácia čaká na potvrdenie",
      time: "Termín",
      meeting: "Pripojenie k online stretnutiu",
      waiting: "Odkaz na stretnutie zatiaľ nie je dostupný. Napíš mi na " +
        sender + ".",
      manage: "Správa / zrušenie rezervácie",
      policy:
        "Rezerváciu môžeš zrušiť ty aj ja najneskôr 24 hodín pred začiatkom. Samotné otvorenie odkazu rezerváciu nezruší.",
      payment: "Platené služby sa hradia prevodom po vystavení faktúry.",
      reply: "Pre otázky alebo zmenu termínu odpovedz na tento e-mail.",
    }
    : {
      confirmed: "Konzultace je potvrzená",
      pending: "Konzultace čeká na potvrzení",
      time: "Termín",
      meeting: "Připojení k online schůzce",
      waiting: "Odkaz na schůzku zatím není dostupný. Napiš mi na " + sender +
        ".",
      manage: "Správa / zrušení rezervace",
      policy:
        "Rezervaci můžeš zrušit ty i já nejpozději 24 hodin před začátkem. Samotné otevření odkazu rezervaci nezruší.",
      payment: "Placené služby se hradí převodem po vystavení faktury.",
      reply: "Pro dotazy nebo změnu termínu odpověz na tento e-mail.",
    };
  return {
    subject: `${pending ? t.pending : t.confirmed} — Adam Pruška`,
    text: [
      pending ? t.pending : t.confirmed,
      String(booking.title || "Konzultace"),
      `${t.time}: ${date} (${zone})`,
      !pending && meeting ? `${t.meeting}:\n${meeting}` : t.waiting,
      `${t.manage}:\n${base.href}`,
      t.policy,
      t.payment,
      t.reply,
      "Adam Pruška",
      sender,
    ].join("\n\n"),
  };
}
async function messageId(uid: string, status: string) {
  const namespace = Uint8Array.from([
    0x6b,
    0xa7,
    0xb8,
    0x10,
    0x9d,
    0xad,
    0x11,
    0xd1,
    0x80,
    0xb4,
    0x00,
    0xc0,
    0x4f,
    0xd4,
    0x30,
    0xc8,
  ]);
  const name = new TextEncoder().encode(
      `adampruska.cz/booking/${uid}/${status}`,
    ),
    input = new Uint8Array(namespace.length + name.length);
  input.set(namespace);
  input.set(name, namespace.length);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", input))
    .slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${
    hex.slice(16, 20)
  }-${hex.slice(20)}`;
}
export async function sendBookingConfirmation(
  booking: any,
  cancellationToken: string,
  language: string,
) {
  if ((config("BOOKING_EMAIL_MODE", false) || "cal") !== "app") {
    return { status: "cal" };
  }
  const mail = mailStatus();
  if (!mail.mail_send || mail.mailbox.toLowerCase() !== sender) {
    return { status: "unavailable" };
  }
  try {
    const message = bookingMailText(booking, cancellationToken, language);
    const result = await sendMail({
      ...message,
      to: booking.attendees[0].email,
      id: await messageId(booking.uid, String(booking.status).toLowerCase()),
    });
    return { status: result.status === "sent" ? "sent" : "uncertain" };
  } catch {
    return { status: "uncertain" };
  }
}
