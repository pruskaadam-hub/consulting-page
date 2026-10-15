import {
  ApiError,
  eventInput,
  hmacHex,
  sameSignature,
  verifyStripe,
  UUID,
} from "../_shared/contracts.mjs";
import { config, requireAdmin, serviceClient } from "../_shared/auth.ts";
import { analyticsReport } from "../_shared/google.ts";
import { mailStatus, readMail, sendMail } from "../_shared/mail.ts";
import { limitedText } from "../_shared/http.ts";

const site = () =>
  new URL(config("SITE_URL", false) || "https://adampruska.cz/");
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function payload(req: Request, max = 30000) {
  const raw = await limitedText(req, max);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("Neplatný požadavek.");
  }
}
async function route(req: Request) {
  const url = new URL(req.url),
    path = url.pathname.split("/admin-api")[1] || "/";
  if (req.method === "POST" && path === "/events") {
    const item = eventInput(await payload(req, 1500));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const bucket = await hmacHex(
      config("EVENTS_HMAC_SECRET"),
      `${ip}:${Math.floor(Date.now() / 60000)}`,
    );
    const result = await serviceClient().rpc("accept_event", {
      p_bucket: bucket,
      p_event: item,
    });
    if (result.error) throw new ApiError("Událost nebyla uložena.", 502);
    return json(
      { accepted: result.data === true },
      result.data === true ? 202 : 429,
    );
  }
  if (req.method === "POST" && path === "/stripe-webhook") {
    const raw = await limitedText(req, 100000);
    if (
      !(await verifyStripe(
        raw,
        req.headers.get("stripe-signature"),
        config("STRIPE_WEBHOOK_SECRET"),
      ))
    )
      throw new ApiError("Neplatný podpis.", 401);
    const event = JSON.parse(raw),
      session = event.data?.object;
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type) &&
      session?.payment_status === "paid"
    ) {
      if (!UUID.test(session.metadata?.order_id || ""))
        throw new ApiError("Chybí objednávka.");
      const result = await serviceClient().rpc("apply_payment", {
        p_event: event.id,
        p_order: session.metadata.order_id,
        p_amount: session.amount_total,
        p_currency: session.currency,
        p_provider: session.id,
      });
      if (result.error)
        throw new ApiError("Platbu se nepodařilo přiřadit.", 409);
    }
    if (
      ["invoice.finalized", "invoice.paid", "invoice.payment_failed"].includes(
        event.type,
      ) &&
      UUID.test(session?.metadata?.order_id || "")
    ) {
      const safeUrl = (value: string | null) => {
        try {
          const u = new URL(value || "");
          return u.protocol === "https:" &&
            [
              "invoice.stripe.com",
              "pay.stripe.com",
              "files.stripe.com",
            ].includes(u.hostname)
            ? u.href
            : null;
        } catch {
          return null;
        }
      };
      const result = await serviceClient().rpc("apply_stripe_invoice", {
        p_invoice: {
          id: session.id,
          order_id: session.metadata.order_id,
          number: session.number,
          status: session.status,
          amount_minor: session.total,
          tax_minor:
            typeof session.total_excluding_tax === "number"
              ? session.total - session.total_excluding_tax
              : null,
          currency: session.currency,
          hosted_url: safeUrl(session.hosted_invoice_url),
          pdf_url: safeUrl(session.invoice_pdf),
        },
        p_created: event.created,
      });
      if (result.error)
        throw new ApiError("Stripe fakturu se nepodařilo uložit.", 409);
    }
    if (
      event.type === "charge.refunded" &&
      UUID.test(session?.metadata?.order_id || "")
    ) {
      const result = await serviceClient().rpc("apply_refund", {
        p_event: event.id,
        p_order: session.metadata.order_id,
        p_refunded: session.amount_refunded,
      });
      if (result.error)
        throw new ApiError("Vrácení platby se nepodařilo přiřadit.", 409);
    }
    return json({ received: true });
  }
  if (req.method === "POST" && path === "/cal-webhook") {
    const raw = await limitedText(req, 100000);
    const signature = (req.headers.get("x-cal-signature-256") || "").replace(
      /^sha256=/,
      "",
    );
    if (
      !sameSignature(
        signature,
        await hmacHex(config("CAL_WEBHOOK_SECRET"), raw),
      )
    )
      throw new ApiError("Neplatný podpis.", 401);
    const event = JSON.parse(raw),
      p = event.payload;
    if (
      [
        "BOOKING_CREATED",
        "BOOKING_RESCHEDULED",
        "BOOKING_CANCELLED",
        "BOOKING_REQUESTED",
      ].includes(event.triggerEvent) &&
      p?.uid
    ) {
      const result = await serviceClient().rpc("apply_booking", {
        p_uid: String(p.uid),
        p_name: p.attendees?.[0]?.name || "",
        p_email: p.attendees?.[0]?.email || "",
        p_title: p.title || "Konzultace",
        p_starts: p.startTime,
        p_status:
          event.triggerEvent === "BOOKING_CANCELLED"
            ? "cancelled"
            : event.triggerEvent === "BOOKING_REQUESTED" ||
                p.requiresConfirmation
              ? "pending"
              : "accepted",
        p_event_time: event.createdAt || new Date().toISOString(),
      });
      if (result.error)
        throw new ApiError("Rezervaci se nepodařilo uložit.", 502);
    }
    return json({ received: true });
  }
  const { client } = await requireAdmin(req);
  if (req.method === "GET" && path === "/status")
    return json({
      ...mailStatus(),
      analytics: Boolean(
        config("GA4_PROPERTY_ID", false) &&
          config("GOOGLE_SERVICE_ACCOUNT_JSON", false),
      ),
      payments: Boolean(
        config("STRIPE_SECRET_KEY", false) &&
          config("STRIPE_WEBHOOK_SECRET", false),
      ),
      invoicing: Boolean(
        config("STRIPE_SECRET_KEY", false) &&
          config("STRIPE_WEBHOOK_SECRET", false),
      ),
      tax: config("STRIPE_AUTOMATIC_TAX", false) === "true",
      stripe_mode: config("STRIPE_SECRET_KEY", false).startsWith("sk_live_")
        ? "live"
        : "test",
      bookings: Boolean(config("CAL_WEBHOOK_SECRET", false)),
      events: Boolean(config("EVENTS_HMAC_SECRET", false)),
    });
  if (req.method === "GET" && path === "/analytics")
    return json(await analyticsReport());
  if (req.method === "GET" && path === "/mail") {
    const rawUid = url.searchParams.get("uid");
    if (rawUid && !/^[1-9]\d{0,9}$/.test(rawUid))
      throw new ApiError("Neplatná zpráva.");
    return json(await readMail(rawUid ? Number(rawUid) : undefined));
  }
  if (req.method === "POST" && path === "/mail") {
    return json(await sendMail(await payload(req)));
  }
  if (req.method === "POST" && path === "/checkout") {
    const input = await payload(req, 1000);
    if (!UUID.test(input.order_id || ""))
      throw new ApiError("Neplatná objednávka.");
    const order = await client
      .from("orders")
      .select("*,clients(email)")
      .eq("id", input.order_id)
      .single();
    if (order.error || !order.data || order.data.status !== "pending")
      throw new ApiError("Objednávka není připravená k úhradě.", 409);
    const o = order.data;
    const stripeKey = config("STRIPE_SECRET_KEY");
    const reserved = await client.rpc("begin_checkout", { p_order: o.id });
    if (reserved.error)
      throw new ApiError(
        "Objednávka už má místní fakturu nebo není připravená pro Stripe.",
        409,
      );
    const body = new URLSearchParams({
      mode: "payment",
      success_url: new URL("?payment=received", site()).href,
      cancel_url: site().href,
      customer_email: o.clients.email,
      customer_creation: "always",
      billing_address_collection: "required",
      "tax_id_collection[enabled]": "true",
      "automatic_tax[enabled]":
        config("STRIPE_AUTOMATIC_TAX", false) === "true" ? "true" : "false",
      "invoice_creation[enabled]": "true",
      "invoice_creation[invoice_data][metadata][order_id]": o.id,
      "metadata[order_id]": o.id,
      "payment_intent_data[metadata][order_id]": o.id,
      "line_items[0][price_data][currency]": "czk",
      "line_items[0][price_data][tax_behavior]": "inclusive",
      "line_items[0][price_data][unit_amount]": String(o.amount_minor),
      "line_items[0][price_data][product_data][name]": o.description,
      "line_items[0][quantity]": "1",
    });
    const taxCode = config("STRIPE_PRODUCT_TAX_CODE", false);
    if (taxCode) {
      if (!/^txcd_\d{8}$/.test(taxCode))
        throw new ApiError("Zkontroluj daňový kód služby ve Stripe.", 503);
      body.set("line_items[0][price_data][product_data][tax_code]", taxCode);
    }
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Stripe-Version": "2025-06-30.basil",
          "Idempotency-Key": `order-${o.id}-${o.amount_minor}`,
        },
        body,
      },
    );
    if (!response.ok)
      throw new ApiError(
        "Platební odkaz se nepodařilo vytvořit. Zkontroluj Stripe před opakováním.",
        502,
      );
    const result = await response.json();
    if (!result.url?.startsWith("https://checkout.stripe.com/"))
      throw new ApiError("Platební odkaz se nepodařilo ověřit.", 502);
    return json({ url: result.url });
  }
  throw new ApiError("Tato funkce není dostupná.", 404);
}
export async function handle(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = (config("ALLOWED_ORIGINS", false) || site().origin)
    .split(",")
    .map((s) => s.trim());
  if (origin && !allowed.includes(origin))
    return json({ error: "Nepovolený původ požadavku." }, 403);
  let response: Response;
  if (req.method === "OPTIONS") response = new Response(null, { status: 204 });
  else
    try {
      response = await route(req);
    } catch (error) {
      response = json(
        {
          error:
            error instanceof ApiError
              ? error.message
              : "Operace se nezdařila. Zkontroluj připojení služby.",
        },
        error instanceof ApiError ? error.status : 502,
      );
    }
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "authorization,apikey,content-type,x-client-info",
    );
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  return response;
}
if (import.meta.main) Deno.serve(handle);
