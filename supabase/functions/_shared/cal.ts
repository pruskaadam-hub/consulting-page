import { mailReadiness } from "./mail-readiness.ts";
import { safeMeetingUrl, sendBookingConfirmation } from "./booking-mail.ts";
import { saveBooking, syncBookings } from "./cal-sync.ts";
import { mailStatus } from "./mail.ts";
import { bookingPayload } from "../../../src/cal-client.mjs";
import { ApiError, hmacHex, sameSignature } from "./contracts.mjs";
import { config, requireAdmin } from "./auth.ts";
import { limitedText } from "./http.ts";
const origin = "https://api.cal.com/v2";
const cutoff = 24 * 60 * 60 * 1000;
const services: Record<string, { slug: string; minutes: number }> = {
  intro: { slug: "nezavazna-konzultace", minutes: 30 },
  individual: { slug: "individualni-konzultace", minutes: 50 },
  package: { slug: "individualni-konzultace", minutes: 50 },
};
async function input(req: Request) {
  try {
    return JSON.parse(await limitedText(req, 20000));
  } catch {
    throw new ApiError("Neplatný požadavek.", 400);
  }
}
async function cal(path: string, method = "GET", body?: unknown) {
  const response = await fetch(origin + path, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${config("CAL_API_KEY")}`,
      "Content-Type": "application/json",
      "cal-api-version": path.startsWith("/slots")
        ? "2024-09-04"
        : path.startsWith("/bookings")
        ? "2024-08-13"
        : "2024-06-14",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    const message = String(failure?.error?.message ?? failure?.message ?? "")
      .toLowerCase();
    const detail = /event\s*type|eventtype/.test(message)
      ? " Událost nebyla nalezena."
      : /api.?key|token/.test(message)
      ? " API klíč nebyl nalezen nebo přijat."
      : /user/.test(message)
      ? " Profil nebyl nalezen."
      : /cannot (get|post)|route/.test(message)
      ? " API cesta nebyla nalezena."
      : "";
    throw new ApiError(
      `Cal.com požadavek nebyl dokončen (HTTP ${response.status}).${detail}`,
      response.status === 409 ? 409 : response.status >= 500 ? 502 : 400,
    );
  }
  return response.json();
}
export async function calRoute(req: Request, path: string) {
  if (req.method === "GET" && path === "/cal/health") {
    const profile = await cal("/me");
    const bookings = await cal("/bookings?take=1&status=upcoming");
    if (
      profile?.status !== "success" ||
      typeof profile.data?.email !== "string" ||
      bookings?.status !== "success" || !Array.isArray(bookings.data)
    ) {
      throw new ApiError(
        "Soukromé napojení Cal.com se nepodařilo ověřit.",
        502,
      );
    }
    return Response.json({
      mailDelivery: await mailReadiness(),
      calendarConnected: true,
      bookingRead: true,
      organizerAddressMatches:
        profile.data.email.toLowerCase() === "adam@adampruska.cz",
    }, { headers: { "Cache-Control": "public,max-age=60" } });
  }
  if (req.method === "POST" && path === "/cal/sync") {
    await requireAdmin(req);
    return Response.json(await syncBookings((path) => cal(path)), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (req.method === "GET" && path === "/cal/communication") {
    await requireAdmin(req);
    const result = await cal("/me");
    if (
      result?.status !== "success" || typeof result.data?.email !== "string"
    ) throw new ApiError("Účet Cal.com se nepodařilo ověřit.", 502);
    const mail = mailStatus();
    return Response.json({
      mailDelivery: await mailReadiness(),
      calendarEmail: result.data.email,
      calendarUsername: result.data.username || "",
      sender: mail.mailbox,
      mailRead: mail.mail_read,
      mailSend: mail.mail_send,
      mailProvider: mail.mail_provider,
      webhookSecretConfigured: Boolean(config("CAL_WEBHOOK_SECRET", false)),
      confirmationProvider: config("BOOKING_EMAIL_MODE", false) === "app"
        ? "app"
        : "cal.com",
      managementLinkEmail: config("BOOKING_EMAIL_MODE", false) === "app" &&
        mail.mail_send && mail.mailbox.toLowerCase() === "adam@adampruska.cz",
    }, { headers: { "Cache-Control": "no-store" } });
  }
  if (req.method === "GET" && path === "/cal/slots") {
    const params = new URL(req.url).searchParams;
    const slug = params.get("eventTypeSlug");
    if (
      params.get("username") !== "adam-pruska" ||
      !Object.values(services).some((s) => s.slug === slug)
    ) throw new ApiError("Neplatná služba.");
    const start = Date.parse(params.get("start") || ""),
      end = Date.parse(params.get("end") || "");
    if (
      !Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      end - start > 35 * 86400000
    ) throw new ApiError("Neplatný rozsah.");
    try {
      new Intl.DateTimeFormat("cs", { timeZone: params.get("timeZone") || "" });
    } catch {
      throw new ApiError("Neplatné časové pásmo.");
    }
    const query = new URLSearchParams({
      username: "adam-pruska",
      eventTypeSlug: slug!,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      timeZone: params.get("timeZone")!,
      format: "range",
    });
    return Response.json(await cal("/slots?" + query), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (req.method === "POST" && path === "/cal/bookings") {
    const options = await input(req), service = services[options.serviceId];
    if (
      !service || options.username !== "adam-pruska" ||
      options.eventTypeSlug !== service.slug
    ) throw new ApiError("Neplatná služba.");
    let body;
    try {
      body = bookingPayload(options);
    } catch {
      throw new ApiError(
        "Doplň jméno, e-mail, téma, situaci a časový horizont.",
      );
    }
    const observedAt = new Date().toISOString();
    const result = await cal("/bookings", "POST", body);
    if (!result.data?.uid || !Number.isFinite(Date.parse(result.data.start))) {
      throw new ApiError("Nepodařilo se ověřit potvrzení.", 502);
    }
    let adminSyncPending = false;
    try {
      await saveBooking({
        ...result.data,
        attendees: result.data.attendees || [body.attendee],
      }, observedAt);
    } catch {
      adminSyncPending = true;
    }
    const tokenBody = encodeURIComponent(
      JSON.stringify({ uid: result.data.uid, start: result.data.start }),
    );
    const cancellationToken = tokenBody + "." +
      await hmacHex(config("CAL_API_KEY"), tokenBody);
    const normalizedBooking = {
      ...result.data,
      attendees: result.data.attendees || [body.attendee],
    };
    const confirmationEmail = await sendBookingConfirmation(
      normalizedBooking,
      cancellationToken,
      options.language || "cs",
    );
    return Response.json({
      ...result,
      cancellationToken,
      adminSyncPending,
      confirmationEmail: confirmationEmail.status,
      meetingUrl: safeMeetingUrl(result.data),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (req.method === "POST" && path === "/cal/cancel") {
    const value = await input(req);
    let uid: string;
    if (value.cancellationToken) {
      if (
        typeof value.cancellationToken !== "string" ||
        value.cancellationToken.length > 2000
      ) throw new ApiError("Neplatný odkaz.", 403);
      const split = value.cancellationToken.lastIndexOf("."),
        raw = value.cancellationToken.slice(0, split),
        signature = value.cancellationToken.slice(split + 1);
      if (
        !sameSignature(await hmacHex(config("CAL_API_KEY"), raw), signature)
      ) throw new ApiError("Neplatný odkaz.", 403);
      try {
        uid = JSON.parse(decodeURIComponent(raw)).uid;
      } catch {
        throw new ApiError("Neplatný odkaz.", 403);
      }
    } else {
      await requireAdmin(req);
      uid = value.uid;
    }
    if (typeof uid !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(uid)) {
      throw new ApiError("Neplatná rezervace.");
    }
    const booking = await cal("/bookings/" + encodeURIComponent(uid));
    const start = Date.parse(booking.data?.start);
    if (!Number.isFinite(start) || start - Date.now() < cutoff) {
      throw new ApiError(
        "Obě strany mohou zrušit rezervaci nejpozději 24 hodin předem.",
        409,
      );
    }
    const observedAt = new Date().toISOString();
    const result = await cal(
      "/bookings/" + encodeURIComponent(uid) + "/cancel",
      "POST",
      { cancellationReason: "Zrušení rezervace nejpozději 24 hodin předem." },
    );
    let adminSyncPending = false;
    try {
      await saveBooking({ ...booking.data, status: "cancelled" }, observedAt);
    } catch {
      adminSyncPending = true;
    }
    return Response.json({ ...result, adminSyncPending }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  throw new ApiError("Neplatná operace.", 404);
}
