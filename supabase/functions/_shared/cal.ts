import { bookingPayload } from "../../../src/cal-client.mjs";
import { ApiError, hmacHex, sameSignature } from "./contracts.mjs";
import { config, requireAdmin } from "./auth.ts";
import { limitedText } from "./http.ts";
const origin = "https://api.cal.com/v2";
const cutoff = 24 * 60 * 60 * 1000;
const services: Record<string, { slug: string; minutes: number }> = {
  intro: { slug: "nezavazna-konzultace", minutes: 30 },
  individual: { slug: "soukroma-konzultace", minutes: 50 },
  package: { slug: "soukroma-konzultace", minutes: 50 },
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
        : "2024-08-13",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new ApiError(
      `Cal.com požadavek nebyl dokončen (HTTP ${response.status}).`,
      response.status === 409 ? 409 : response.status >= 500 ? 502 : 400,
    );
  }
  return response.json();
}
export async function calRoute(req: Request, path: string) {
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
    const result = await cal("/bookings", "POST", body);
    if (!result.data?.uid || !Number.isFinite(Date.parse(result.data.start))) {
      throw new ApiError("Nepodařilo se ověřit potvrzení.", 502);
    }
    const tokenBody = encodeURIComponent(
      JSON.stringify({ uid: result.data.uid, start: result.data.start }),
    );
    const cancellationToken = tokenBody + "." +
      await hmacHex(config("CAL_API_KEY"), tokenBody);
    return Response.json({ ...result, cancellationToken }, {
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
    return Response.json(
      await cal("/bookings/" + encodeURIComponent(uid) + "/cancel", "POST", {
        cancellationReason: "Zrušení rezervace nejpozději 24 hodin předem.",
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  throw new ApiError("Neplatná operace.", 404);
}
