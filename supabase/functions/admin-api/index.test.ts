import { NativeImap } from "../_shared/mail-imap.ts";
import { MailWire } from "../_shared/mail-wire.ts";
import { mailSource, submitSmtp, SmtpFailure } from "../_shared/mail-smtp.ts";
import PostalMime from "npm:postal-mime@4.0.5";
import { mailReadiness } from "../_shared/mail-readiness.ts";
import { syncBookings, bookingRecord } from "../_shared/cal-sync.ts";
import { bookingMailText, sendBookingConfirmation } from "../_shared/booking-mail.ts";
import { handle } from "./index.ts";
import { limitedText } from "../_shared/http.ts";
import { hmacHex } from "../_shared/contracts.mjs";
import { mailboxError, mailStatus, readWebsiteMail, sendMail, sendIcloudMail, deliverIcloud } from "../_shared/mail.ts";
import {
  analyticsConfigured,
  analyticsReport,
  reportError,
} from "../_shared/google.ts";
function assert(value: unknown, message = "Assertion failed") {
  if (!value) throw new Error(message);
}
const url = "https://project.supabase.co/functions/v1/admin-api";
Deno.env.set("SITE_URL", "https://adampruska.cz/");
Deno.test(
  "every private endpoint denies missing authorization before contacting a provider",
  async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      throw new Error("Unexpected external request");
    };
    try {
      for (const path of ["/status", "/analytics", "/mail", "/checkout"]) {
        const response = await handle(new Request(url + path));
        assert(response.status === 401, path);
        await response.body?.cancel();
      }
      const send = await handle(
        new Request(url + "/mail", { method: "POST", body: "{}" }),
      );
      assert(send.status === 401);
      await send.body?.cancel();
      assert(calls === 0);
    } finally {
      globalThis.fetch = original;
    }
  },
);

async function withMailFixture(run: () => void | Promise<void>) {
  const values: Record<string, string> = {
    MAIL_PROVIDER: "icloud",
    MAIL_DELIVERY_PROVIDER: "resend",
    ICLOUD_SMTP_DIRECT:"",
    MAIL_FROM_EMAIL: "adam@adampruska.cz",
    ICLOUD_USERNAME: "owner@icloud.com",
    ICLOUD_APP_PASSWORD: "fixture-app-password",
    RESEND_API_KEY: "re_fixture_only",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  };
  const previous = new Map(
    Object.keys(values).map((key) => [key, Deno.env.get(key)]),
  );
  for (const [key, value] of Object.entries(values)) Deno.env.set(key, value);
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}
const mailMessage = {
  id: "55555555-5555-4555-8555-555555555555",
  to: "client@example.test",
  subject: "Fixture only",
  text: "This message must never reach a real provider.",
};
Deno.test("GA4 errors distinguish disabled Data API, property permissions and quotas without exposing raw diagnostics", async () => {
  const secret = "DO_NOT_EXPOSE_PRIVATE_KEY_OR_TOKEN";
  const email = "reader@fixture.iam.gserviceaccount.com";
  const disabled = await reportError(
    Response.json({
      error: {
        message: secret,
        details: [{
          "@type": "type.googleapis.com/google.rpc.ErrorInfo",
          reason: "SERVICE_DISABLED",
          metadata: {
            consumer: "projects/123456789",
            service: "analyticsdata.googleapis.com",
            private_key: secret,
          },
        }],
      },
    }, { status: 403 }),
    "559071834",
    email,
  );
  assert(disabled.message.includes("Data API není zapnuté"));
  assert(
    disabled.message.includes("123456789") && disabled.message.includes(email),
  );
  const denied = await reportError(
    Response.json({ error: { message: secret } }, { status: 403 }),
    "559071834",
    email,
  );
  assert(
    denied.message.includes("559071834") && denied.message.includes("Viewer"),
  );
  assert(denied.message.includes(email));
  const limited = await reportError(
    new Response(secret, { status: 429 }),
    "559071834",
    email,
  );
  assert(limited.message.includes("HTTP 429"));
  const unavailable = await reportError(
    new Response(secret, { status: 503 }),
    "559071834",
    "not-a-service-account",
  );
  assert(
    unavailable.message.includes("HTTP 503") &&
      !unavailable.message.includes("not-a-service-account"),
  );
  for (const error of [disabled, denied, limited, unavailable]) {
    assert(!error.message.includes(secret));
  }
});
Deno.test("GA4 reports use the supplied property, a read-only token and provider totals; optional property override works", async () => {
  const previousProperty = Deno.env.get("GA4_PROPERTY_ID");
  const previousAccount = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const original = globalThis.fetch;
  try {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const bytes = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
    );
    const clientEmail = "fixture@fixture.iam.gserviceaccount.com";
    Deno.env.set(
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      JSON.stringify({
        client_email: clientEmail,
        private_key: `-----BEGIN PRIVATE KEY-----\n${
          btoa(String.fromCharCode(...bytes))
        }\n-----END PRIVATE KEY-----`,
      }),
    );
    let property = "559071834", calls = 0;
    globalThis.fetch = (input, init) => {
      calls++;
      const target = String(input);
      if (target === "https://oauth2.googleapis.com/token") {
        const body = new URLSearchParams(String(init?.body));
        assert(
          body.get("grant_type") ===
            "urn:ietf:params:oauth:grant-type:jwt-bearer",
        );
        const payload = JSON.parse(
          atob(
            body.get("assertion")!.split(".")[1].replaceAll("-", "+")
              .replaceAll("_", "/"),
          ),
        );
        assert(payload.iss === clientEmail);
        assert(
          payload.scope ===
            "https://www.googleapis.com/auth/analytics.readonly",
        );
        return Promise.resolve(
          Response.json({ access_token: "fixture-google-token" }),
        );
      }
      assert(
        target ===
          `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
      );
      assert(
        new Headers(init?.headers).get("Authorization") ===
          "Bearer fixture-google-token",
      );
      assert(
        JSON.parse(String(init?.body)).dateRanges[0].endDate === "yesterday",
      );
      return Promise.resolve(
        Response.json({
          totals: [{
            metricValues: [{ value: "9" }, { value: "12" }, { value: "20" }],
          }],
          rows: [],
        }),
      );
    };
    for (const id of [undefined, "123456789"]) {
      if (id) Deno.env.set("GA4_PROPERTY_ID", id);
      else Deno.env.delete("GA4_PROPERTY_ID");
      property = id || "559071834";
      assert(analyticsConfigured());
      const result = await analyticsReport();
      assert(
        result.totals.users === 9 && result.totals.sessions === 12 &&
          result.totals.views === 20,
      );
    }
    assert(calls === 4);
  } finally {
    globalThis.fetch = original;
    if (previousProperty === undefined) Deno.env.delete("GA4_PROPERTY_ID");
    else Deno.env.set("GA4_PROPERTY_ID", previousProperty);
    if (previousAccount === undefined) {
      Deno.env.delete("GOOGLE_SERVICE_ACCOUNT_JSON");
    } else Deno.env.set("GOOGLE_SERVICE_ACCOUNT_JSON", previousAccount);
  }
});
Deno.test("consented public events use a server HMAC bucket and the database enforces acceptance or rate limiting", async () => {
  const names = [
    "EVENTS_HMAC_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const before = names.map((name) => Deno.env.get(name));
  Deno.env.set("EVENTS_HMAC_SECRET", "fixture-events-secret");
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key");
  const original = globalThis.fetch;
  let accepted = true, calls = 0;
  globalThis.fetch = (input, init) => {
    calls++;
    assert(String(input).endsWith("/rpc/accept_event"));
    const body = JSON.parse(String(init?.body));
    assert(/^[a-f0-9]{64}$/.test(body.p_bucket));
    assert(body.p_event.name === "consultation_click");
    assert(
      body.p_event.service === "intro" && body.p_event.placement === "hero",
    );
    assert(!JSON.stringify(body).includes("private@example.test"));
    assert(!JSON.stringify(body).includes("203.0.113.1"));
    return Promise.resolve(Response.json(accepted));
  };
  try {
    for (accepted of [true, false]) {
      const response = await handle(
        new Request(url + "/events", {
          method: "POST",
          headers: {
            Origin: "https://adampruska.cz",
            "X-Forwarded-For": "203.0.113.1",
          },
          body: JSON.stringify({
            id: mailMessage.id,
            session_id: mailMessage.id,
            consent: true,
            name: "consultation_click",
            language: "cs",
            path: "/",
            service: "intro",
            placement: "hero",
            email: "private@example.test",
          }),
        }),
      );
      assert(response.status === (accepted ? 202 : 429));
      assert((await response.json()).accepted === accepted);
    }
    assert(calls === 2);
  } finally {
    globalThis.fetch = original;
    names.forEach((name, index) => {
      if (before[index] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, before[index]!);
    });
  }
});
Deno.test("iCloud receipt and HTTPS sending are configured independently and status never exposes secrets", () =>
  withMailFixture(() => {
    assert(mailStatus().mail);
    assert(!JSON.stringify(mailStatus()).includes("fixture"));
    Deno.env.delete("RESEND_API_KEY");
    assert(
      mailStatus().mail_read && !mailStatus().mail_send && !mailStatus().mail,
    );
    Deno.env.set("RESEND_API_KEY", "re_fixture_only");
    Deno.env.delete("ICLOUD_APP_PASSWORD");
    assert(!mailStatus().mail_read && mailStatus().mail_send);
  }));
Deno.test("unconfigured sending stops before writing an outbox entry or contacting providers", () =>
  withMailFixture(async () => {
    Deno.env.delete("RESEND_API_KEY");
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      throw new Error("Unexpected request");
    };
    try {
      let status = 0;
      try {
        await sendMail(mailMessage);
      } catch (error) {
        status = (error as { status: number }).status;
      }
      assert(status === 503 && calls === 0);
    } finally {
      globalThis.fetch = original;
    }
  }));
Deno.test("HTTPS mail claims the outbox first, fixes From and Reply-To to the domain, and uses idempotency", () =>
  withMailFixture(async () => {
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (input, init) => {
      const target = String(input);
      calls.push(target);
      if (target === "https://api.resend.com/emails") {
        assert(calls.length === 2, "Claim must precede delivery");
        const body = JSON.parse(String(init?.body));
        assert(body.from === "Adam Pruška <adam@adampruska.cz>");
        assert(body.reply_to === "adam@adampruska.cz");
        assert(body.to.length === 1 && body.to[0] === mailMessage.to);
        assert(body.text === mailMessage.text && body.html === undefined);
        const headers = new Headers(init?.headers);
        assert(headers.get("Authorization") === "Bearer re_fixture_only");
        assert(headers.get("Idempotency-Key") === `mail/${mailMessage.id}`);
        return Promise.resolve(Response.json({ id: "provider-message-id" }));
      }
      assert(target.includes("/rest/v1/mail_outbox"));
      const body = JSON.parse(String(init?.body));
      assert(body.status === (init?.method === "PATCH" ? "sent" : "sending"));
      if (init?.method === "PATCH") {
        assert(body.message_id === "provider-message-id");
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    };
    try {
      const result = await sendMail({
        ...mailMessage,
        from: "spoof@other.example",
        reply_to: "other@other.example",
      });
      assert(result.status === "sent" && calls.length === 3);
    } finally {
      globalThis.fetch = original;
    }
  }));
Deno.test("duplicate mail claims cannot contact the delivery provider", () =>
  withMailFixture(async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (input) => {
      calls++;
      assert(String(input).includes("/rest/v1/mail_outbox"));
      return Promise.resolve(
        Response.json({ code: "23505", message: "Duplicate" }, { status: 409 }),
      );
    };
    try {
      let status = 0;
      try {
        await sendMail(mailMessage);
      } catch (error) {
        status = (error as { status: number }).status;
      }
      assert(status === 409 && calls === 1);
    } finally {
      globalThis.fetch = original;
    }
  }));
Deno.test("uncertain HTTPS delivery is recorded without retrying or leaking provider errors", () =>
  withMailFixture(async () => {
    const original = globalThis.fetch;
    let attempts = 0, uncertain = false;
    globalThis.fetch = (input, init) => {
      if (String(input) === "https://api.resend.com/emails") {
        attempts++;
        throw new Error("Private provider diagnostics re_fixture_only");
      }
      assert(String(input).includes("/rest/v1/mail_outbox"));
      if (init?.method === "PATCH") {
        uncertain = JSON.parse(String(init.body)).status === "uncertain";
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    };
    try {
      let message = "";
      try {
        await sendMail(mailMessage);
      } catch (error) {
        message = (error as Error).message;
      }
      assert(attempts === 1 && uncertain && message.includes("není jistý"));
      assert(!message.includes("fixture"));
    } finally {
      globalThis.fetch = original;
    }
  }));
Deno.test("CORS denies another origin; preflight grants no data", async () => {
  const denied = await handle(
    new Request(url + "/status", {
      headers: { Origin: "https://other.example" },
    }),
  );
  assert(denied.status === 403);
  await denied.body?.cancel();
  const allowed = await handle(
    new Request(url + "/status", {
      method: "OPTIONS",
      headers: { Origin: "https://adampruska.cz" },
    }),
  );
  assert(allowed.status === 204);
  assert(
    allowed.headers.get("Access-Control-Allow-Origin") ===
      "https://adampruska.cz",
  );
});
Deno.test(
  "webhooks reject invalid signatures and telemetry requires consent",
  async () => {
    Deno.env.set("PAYMENT_MODE", "stripe");
    Deno.env.set("STRIPE_WEBHOOK_SECRET", "fake-signing-secret");
    Deno.env.set("CAL_WEBHOOK_SECRET", "fake-cal-secret");
    for (const path of ["/stripe-webhook", "/cal-webhook"]) {
      const response = await handle(
        new Request(url + path, { method: "POST", body: "{}" }),
      );
      assert(response.status === 401, path);
      await response.body?.cancel();
    }
    const response = await handle(
      new Request(url + "/events", {
        method: "POST",
        body: JSON.stringify({ consent: false }),
      }),
    );
    assert(response.status === 400);
    await response.body?.cancel();
    Deno.env.delete("PAYMENT_MODE");
  },
);
Deno.test("large chunked requests are stopped while reading", async () => {
  let failed = false;
  try {
    await limitedText(
      new Request(url, { method: "POST", body: "x".repeat(2000) }),
      1000,
    );
  } catch {
    failed = true;
  }
  assert(failed);
});
Deno.test("valid user still needs database authorization and MFA", async () => {
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "fixture-public-key");
  const original = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = (input) => {
    const target = String(input);
    paths.push(target);
    return Promise.resolve(
      Response.json(
        target.includes("/auth/v1/user")
          ? {
            id: "11111111-1111-4111-8111-111111111111",
            email: "fixture@example.test",
          }
          : false,
      ),
    );
  };
  try {
    const response = await handle(
      new Request(url + "/status", {
        headers: { Authorization: "Bearer fixture-token" },
      }),
    );
    assert(response.status === 403);
    await response.body?.cancel();
    assert(paths.some((p) => p.includes("/auth/v1/user")));
    assert(paths.some((p) => p.includes("/rpc/is_admin")));
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test(
  "Checkout uses server prices, inclusive Tax and Stripe Invoicing, never caller supplied totals or redirects",
  async () => {
    Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
    Deno.env.set("SUPABASE_ANON_KEY", "fixture-public-key");
    Deno.env.set("PAYMENT_MODE", "stripe");
    Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fixture_not_real");
    Deno.env.set("STRIPE_AUTOMATIC_TAX", "true");
    const id = "11111111-1111-4111-8111-111111111111";
    const original = globalThis.fetch;
    let checkout = false;
    globalThis.fetch = (input, init) => {
      const target = String(input);
      if (target.includes("api.stripe.com")) {
        checkout = true;
        const body = new URLSearchParams(String(init?.body));
        assert(body.get("line_items[0][price_data][unit_amount]") === "180000");
        assert(
          body.get("line_items[0][price_data][tax_behavior]") === "inclusive",
        );
        assert(body.get("automatic_tax[enabled]") === "true");
        assert(body.get("invoice_creation[enabled]") === "true");
        assert(
          body.get("success_url") === "https://adampruska.cz/?payment=received",
        );
        assert(
          new Headers(init?.headers).get("Authorization") ===
            "Bearer sk_test_fixture_not_real",
        );
        return Promise.resolve(
          Response.json({ url: "https://checkout.stripe.com/c/pay/fixture" }),
        );
      }
      if (target.includes("/auth/v1/user")) {
        return Promise.resolve(
          Response.json({ id, email: "fixture@example.test" }),
        );
      }
      if (target.includes("/rpc/is_admin")) {
        return Promise.resolve(Response.json(true));
      }
      if (target.includes("/rpc/begin_checkout")) {
        const reservation = JSON.parse(String(init?.body));
        assert(reservation.p_is_test === true);
        return Promise.resolve(Response.json({ id }));
      }
      if (target.includes("/rest/v1/orders")) {
        return Promise.resolve(
          Response.json({
            id,
            status: "pending",
            description: "Consultation",
            amount_minor: 180000,
            clients: { email: "client@example.test" },
          }),
        );
      }
      throw new Error("Unexpected request " + target);
    };
    try {
      const response = await handle(
        new Request(url + "/checkout", {
          method: "POST",
          headers: {
            Authorization: "Bearer fixture-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: id,
            amount_minor: 1,
            is_test: false,
            success_url: "https://other.example/",
          }),
        }),
      );
      assert(response.status === 200);
      await response.body?.cancel();
      assert(checkout);
    } finally {
      globalThis.fetch = original;
      Deno.env.delete("PAYMENT_MODE");
    }
  },
);

Deno.test("signed Stripe snapshots forward test/live modes and reject inconsistent payloads", async () => {
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-only");
  Deno.env.set("PAYMENT_MODE", "stripe");
  Deno.env.set("STRIPE_WEBHOOK_SECRET", "fixture-signing-only");
  const original = globalThis.fetch;
  const calls: { target: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (input, init) => {
    const target = String(input);
    assert(target.startsWith("https://project.supabase.co/rest/v1/rpc/"));
    calls.push({ target, body: JSON.parse(String(init?.body)) });
    return Promise.resolve(Response.json(true));
  };
  async function deliver(event: Record<string, unknown>) {
    const raw = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await hmacHex(
      "fixture-signing-only",
      `${timestamp}.${raw}`,
    );
    const response = await handle(
      new Request(url + "/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
        body: raw,
      }),
    );
    await response.body?.cancel();
    return response.status;
  }
  try {
    for (const live of [false, true]) {
      for (
        const [type, rpc] of [
          ["checkout.session.completed", "apply_payment"],
          ["checkout.session.async_payment_succeeded", "apply_payment"],
          ["invoice.finalized", "apply_stripe_invoice"],
          ["invoice.paid", "apply_stripe_invoice"],
          ["invoice.payment_failed", "apply_stripe_invoice"],
          ["charge.refunded", "apply_refund"],
        ]
      ) {
        const object = {
          id: "provider-fixture",
          livemode: live,
          payment_status: "paid",
          metadata: { order_id: "11111111-1111-4111-8111-111111111111" },
          amount_total: 180000,
          total: 180000,
          amount_refunded: 10000,
          currency: "czk",
          status: "paid",
        };
        assert(
          await deliver({
            id: "evt_fixture",
            type,
            livemode: live,
            created: 1,
            data: { object },
          }) === 200,
        );
        const call = calls.at(-1)!;
        assert(call.target.endsWith("/" + rpc));
        assert(call.body.p_is_test === !live);
      }
    }
    const count = calls.length;
    assert(
      await deliver({
        id: "evt_bad",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: { livemode: true, payment_status: "paid" } },
      }) === 400,
    );
    assert(
      await deliver({
        id: "evt_missing",
        type: "checkout.session.completed",
        data: { object: { payment_status: "paid" } },
      }) === 400,
    );
    assert(
      calls.length === count,
      "Invalid modes must never reach the database",
    );
  } finally {
    globalThis.fetch = original;
    Deno.env.delete("PAYMENT_MODE");
  }
});

Deno.test("offline invoice mode is the default and blocks Stripe despite stored credentials", async () => {
  Deno.env.delete("PAYMENT_MODE");
  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fixture_not_real");
  Deno.env.set("STRIPE_WEBHOOK_SECRET", "fixture-signing-only");
  Deno.env.set("STRIPE_AUTOMATIC_TAX", "true");
  const original = globalThis.fetch;
  globalThis.fetch = (input) => {
    const target = String(input);
    if (target.endsWith("/auth/v1/user")) {
      return Promise.resolve(
        Response.json({ id: "11111111-1111-4111-8111-111111111111" }),
      );
    }
    if (target.endsWith("/rpc/is_admin")) {
      return Promise.resolve(Response.json(true));
    }
    throw new Error(
      "Offline mode must not contact Stripe or create a Checkout reservation",
    );
  };
  try {
    const headers = { Authorization: "Bearer fixture-token" };
    const response = await handle(new Request(url + "/status", { headers }));
    const status = await response.json();
    assert(status.payment_mode === "offline");
    assert(
      status.payments === false && status.invoicing === false &&
        status.tax === false,
    );
    for (const path of ["/checkout", "/stripe-webhook"]) {
      const result = await handle(
        new Request(url + path, { method: "POST", headers, body: "{}" }),
      );
      assert(result.status === 503);
      await result.body?.cancel();
    }
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test('Cal proxy keeps credentials server-side, validates intake and enforces cancellation cutoff', async()=>{
  const original=globalThis.fetch, previous=Deno.env.get('CAL_API_KEY');
  Deno.env.set('CAL_API_KEY','fixture-cal-key');
  const start=new Date(Date.now()+3*86400000).toISOString();
  const options={username:'adam-pruska',eventTypeSlug:'individualni-konzultace',serviceId:'individual',start,name:'Fixture',email:'test@example.invalid',timeZone:'Europe/Prague',consultationTopic:'career',situation:'Career planning',horizon:'soon'};
  let calls=0,late=false;
  globalThis.fetch=async(input,init)=>{
    calls++;
    assert(String(input).startsWith('https://api.cal.com/v2/'));
    assert((init?.headers as Record<string,string>).Authorization==='Bearer fixture-cal-key');
    if(init?.method==='POST' && String(input).endsWith('/bookings')){
      const body=JSON.parse(String(init.body));
      assert(body.metadata.service==='individual');
      assert(body.bookingFieldsResponses.notes.includes('Career planning'));
    }
    return Response.json({status:'success',data:{uid:'fixture-booking',start:late?new Date(Date.now()+23*3600000).toISOString():start,status:'accepted'}});
  };
  const post=(path:string,body:unknown)=>handle(new Request(url+path,{method:'POST',headers:{Origin:'https://adampruska.cz','Content-Type':'application/json'},body:JSON.stringify(body)}));
  try {
    let response=await post('/cal/bookings',{...options,situation:''});
    assert(response.status===400);assert(calls===0);await response.body?.cancel();
    response=await post('/cal/bookings',{...options,eventTypeSlug:'other-account'});
    assert(response.status===400);assert(calls===0);await response.body?.cancel();
    response=await post('/cal/bookings',options);
    assert(response.status===200);
    const result=await response.json();assert(result.cancellationToken);assert(!JSON.stringify(result).includes('fixture-cal-key'));
    const before=calls;
    response=await post('/cal/cancel',{cancellationToken:result.cancellationToken+'bad'});
    assert(response.status===403);assert(calls===before);await response.body?.cancel();
    response=await post('/cal/cancel',{uid:'fixture-booking'});
    assert(response.status===401);assert(calls===before);await response.body?.cancel();
    late=true;
    response=await post('/cal/cancel',{cancellationToken:result.cancellationToken});
    assert(response.status===409);assert(calls===before+1);await response.body?.cancel();
    late=false;
    response=await post('/cal/cancel',{cancellationToken:result.cancellationToken});
    assert(response.status===200);assert(calls===before+3);await response.body?.cancel();
  } finally {
    globalThis.fetch=original;
    if(previous===undefined)Deno.env.delete('CAL_API_KEY');else Deno.env.set('CAL_API_KEY',previous);
  }
});

Deno.test('Cal import and communication endpoints require admin access before contacting providers',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=()=>{calls++;throw new Error('Unexpected provider request');};
  try {
    for(const [path,method] of [['/cal/sync','POST'],['/cal/communication','GET']]) {
      const response=await handle(new Request(url+path,{method}));assert(response.status===401);await response.body?.cancel();
    }
    assert(calls===0);
  }finally{globalThis.fetch=original;}
});
Deno.test('Cal snapshots import accepted, pending and cancelled bookings through the service-only upsert',()=>withMailFixture(async()=>{
  const original=globalThis.fetch;const records:Record<string,any>[]=[];
  globalThis.fetch=(input,init)=>{
    assert(String(input).includes('/rpc/apply_booking'));
    assert(init?.headers && new Headers(init.headers).get('authorization')==='Bearer fixture-service-key');
    records.push(JSON.parse(String(init?.body)));return Promise.resolve(Response.json(null));
  };
  const row={uid:'cal-fixture',title:'Consultation',start:'2030-06-01T10:00:00Z',attendees:[{name:'Fixture',email:'client@example.test'}]};
  try {
    const result=await syncBookings(async(path)=>{assert(path.includes('take=100') && path.includes('cancelled'));return {status:'success',data:['accepted','pending','cancelled'].map((status,index)=>({...row,uid:row.uid+index,status}))};});
    assert(result.synced===3);assert(records.map(r=>r.p_status).join(',')==='accepted,pending,cancelled');
    assert(records.every(r=>r.p_event_time===result.syncedAt));
    let rejected=false;
    try {await syncBookings(async()=>({status:'success',data:[{...row,status:'accepted'},{uid:'broken'}]}));}catch{rejected=true;}
    assert(rejected && records.length===3,'Invalid snapshots must not partially import');
    assert(bookingRecord({...row,status:'unconfirmed'},result.syncedAt).p_status==='pending');
  }finally{globalThis.fetch=original;}
}));
Deno.test('Booking mail separates meeting and cancellation links, uses the domain sender, and is off by default',()=>withMailFixture(async()=>{
  const previous=Deno.env.get('BOOKING_EMAIL_MODE');Deno.env.delete('BOOKING_EMAIL_MODE');
  const original=globalThis.fetch;let calls=0,resendBody:any,mailIds:string[]=[];
  const booking={uid:'mail-fixture',title:'Consultation',status:'accepted',start:'2030-06-01T10:00:00Z',meetingUrl:'https://meet.example.test/fixture',attendees:[{email:'client@example.test',timeZone:'Europe/Prague'}]};
  globalThis.fetch=(input,init)=>{
    calls++;
    if(String(input)==='https://api.resend.com/emails') {resendBody=JSON.parse(String(init?.body));return Promise.resolve(Response.json({id:'fixture-delivery'}));}
    assert(String(input).includes('/rest/v1/mail_outbox'));
    if(init?.method==='POST')mailIds.push(JSON.parse(String(init.body)).id);
    return Promise.resolve(new Response(null,{status:201}));
  };
  try {
    assert((await sendBookingConfirmation(booking,'private-token','cs')).status==='cal');assert(calls===0);
    const pending=bookingMailText({...booking,status:'pending'},'private-token','cs');assert(pending.subject.includes('čeká'));assert(!pending.text.includes(booking.meetingUrl));
    Deno.env.set('BOOKING_EMAIL_MODE','app');
    assert((await sendBookingConfirmation(booking,'private-token','cs')).status==='sent');
    assert(resendBody.to.join(',')==='client@example.test');assert(resendBody.reply_to==='adam@adampruska.cz');assert(resendBody.from==='Adam Pruška <adam@adampruska.cz>');
    assert(resendBody.text.includes(booking.meetingUrl) && resendBody.text.includes('?sprava-rezervace#private-token') && resendBody.text.includes('24 hodin'));
    assert(!resendBody.text.includes('yahoo') && !resendBody.text.includes('pruskaadam@me.com'));
    await sendBookingConfirmation(booking,'private-token','cs');assert(mailIds[0]===mailIds[1],'One booking status has one stable mail claim');
  }finally{globalThis.fetch=original;if(previous===undefined)Deno.env.delete('BOOKING_EMAIL_MODE');else Deno.env.set('BOOKING_EMAIL_MODE',previous);}
}));
Deno.test('An uncertain confirmation email never turns an accepted booking into a retry',()=>withMailFixture(async()=>{
  const original=globalThis.fetch,mode=Deno.env.get('BOOKING_EMAIL_MODE'),key=Deno.env.get('CAL_API_KEY');
  Deno.env.set('BOOKING_EMAIL_MODE','app');Deno.env.set('CAL_API_KEY','fixture-cal-key');let creations=0;
  const start=new Date(Date.now()+3*86400000).toISOString();
  globalThis.fetch=(input,init)=>{
    const target=String(input);
    if(target==='https://api.cal.com/v2/bookings') {creations++;return Promise.resolve(Response.json({status:'success',data:{uid:'accepted-mail-failure',start,status:'accepted',meetingUrl:'https://meet.example.test/fixture',attendees:[{name:'Fixture',email:'client@example.test',timeZone:'Europe/Prague'}]}}));}
    if(target.includes('/rpc/apply_booking'))return Promise.resolve(Response.json(null));
    if(target.includes('/rest/v1/mail_outbox'))return Promise.resolve(new Response(null,{status:201}));
    if(target==='https://api.resend.com/emails')return Promise.resolve(Response.json({error:'fixture failure'},{status:503}));
    throw new Error('Unexpected provider request');
  };
  try {
    const response=await handle(new Request(url+'/cal/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'adam-pruska',eventTypeSlug:'individualni-konzultace',serviceId:'individual',start,name:'Fixture',email:'client@example.test',timeZone:'Europe/Prague',consultationTopic:'career',situation:'Career planning',horizon:'soon'})}));
    const result=await response.json();assert(response.status===200 && result.data.status==='accepted');assert(result.confirmationEmail==='uncertain' && result.cancellationToken && result.meetingUrl);assert(creations===1);
  } finally {globalThis.fetch=original;if(mode===undefined)Deno.env.delete('BOOKING_EMAIL_MODE');else Deno.env.set('BOOKING_EMAIL_MODE',mode);if(key===undefined)Deno.env.delete('CAL_API_KEY');else Deno.env.set('CAL_API_KEY',key);}
}));
Deno.test('Public Cal readiness verifies authenticated read access without exposing account or booking data',()=>withMailFixture(async()=>{
  const original=globalThis.fetch,previous=Deno.env.get('CAL_API_KEY');Deno.env.set('CAL_API_KEY','fixture-cal-key');let calls=0;
  globalThis.fetch=(input,init)=>{
    calls++;const target=String(input),headers=new Headers(init?.headers);
    if(target.startsWith('https://api.resend.com/domains'))return Promise.resolve(Response.json({data:[{name:'adampruska.cz',status:'verified'}]}));
    assert(headers.get('authorization')==='Bearer fixture-cal-key');
    if(target.endsWith('/v2/me')) {assert(headers.get('cal-api-version')==='2024-06-14');return Promise.resolve(Response.json({status:'success',data:{email:'private-host@example.test',username:'private-profile'}}));}
    assert(target.includes('/bookings?take=1'));assert(headers.get('cal-api-version')==='2024-08-13');return Promise.resolve(Response.json({status:'success',data:[{uid:'private-booking',attendees:[{email:'private-client@example.test'}]}]}));
  };
  try{const response=await handle(new Request(url+'/cal/health'));const body=await response.text();assert(response.status===200 && calls===2);assert(body.includes('"bookingRead":true') && body.includes('"organizerAddressMatches":false') && body.includes('cal_managed'));assert(!body.includes('private-') && !body.includes('fixture-cal-key'));}
  finally{globalThis.fetch=original;if(previous===undefined)Deno.env.delete('CAL_API_KEY');else Deno.env.set('CAL_API_KEY',previous);}
}));
Deno.test('Mail readiness checks key and domain without sending a message or leaking domain lists',()=>withMailFixture(async()=>{
  const original=globalThis.fetch;let calls=0,mode='ready';
  globalThis.fetch=(input,init)=>{calls++;assert(String(input)==='https://api.resend.com/domains?limit=100' && (!init?.method || init.method==='GET'));
    if(mode==='limited')return Promise.resolve(Response.json({error:'not allowed'},{status:403}));
    return Promise.resolve(Response.json({data:[{name:'private-other-domain.test',status:'verified'},{name:'adampruska.cz',status:mode==='pending'?'pending':'verified'}]}));};
  try {
    const ready=await mailReadiness();assert(ready.status==='ready' && ready.domainVerified===true);assert(!JSON.stringify(ready).includes('private-other-domain'));
    mode='pending';assert((await mailReadiness()).status==='domain_pending');mode='limited';assert((await mailReadiness()).status==='key_scope_unknown');
    Deno.env.delete('RESEND_API_KEY');const before=calls;assert((await mailReadiness()).status==='missing_key' && calls===before);
  }finally{globalThis.fetch=original;}
}));

Deno.test("IMAP diagnostics distinguish authentication from connectivity and never expose provider details", () => {
  const secret = "PRIVATE_PASSWORD_AND_MESSAGE";
  const auth = mailboxError({authenticationFailed:true,response:secret,message:secret});
  assert(auth.status === 502 && auth.message.includes("adresu iCloud Mail"));
  assert(!auth.message.includes(secret));
  for (const code of ["ETIMEDOUT", "CONNECT_TIMEOUT", "GREETING_TIMEOUT"]) {
    const error = mailboxError({code,message:secret});
    assert(error.status === 504 && !error.message.includes(secret));
  }
  const offline = mailboxError({code:"ECONNREFUSED",message:secret});
  assert(offline.message.includes("portu 993") && !offline.message.includes(secret));
  assert(mailboxError({code:"ETHROTTLE"}).status === 503);
  assert(!mailboxError(new Error(secret)).message.includes(secret));
  const missing = mailboxError({message:secret});
  assert(missing.status === 502);
});

Deno.test("website inbox filters before limit, matches exact To/Cc and denies personal UID before reading source", async () => {
  const envelope = (address: string, cc = false) => ({[cc ? "cc" : "to"]:[{address}]});
  const rows = Array.from({length:180}, (_, i) => ({uid:i+1,seq:i+1,envelope:envelope(i < 30 ? "ADAM@adampruska.cz" : "other@icloud.com"),flags:new Set()}));
  rows[29].envelope = envelope("adam@adampruska.cz",true);
  rows[179].envelope = envelope("other-adam@adampruska.cz");
  let sourceReads = 0;
  const fake = {
    mailbox: {exists:rows.length},
    fetch: async function* (range: string) {
      const [start,end] = range.split(":").map(Number);
      for (const row of rows.slice(start-1,end)) yield row;
    },
    fetchOne: async (uid: number, query: {source?: boolean}) => {
      if(query.source) { sourceReads++; throw new Error("Private source must not be fetched"); }
      return {...rows.find(row=>row.uid===uid),size:10};
    },
  } as unknown as Parameters<typeof readWebsiteMail>[0];
  const result = await readWebsiteMail(fake);
  if (!result.messages) throw new Error("Missing message list");
  assert(result.messages.length === 25);
  assert(result.messages[0].uid === 30 && result.messages[24].uid === 6);
  for(const uid of [180,179]) {
    let denied=false;
    try {await readWebsiteMail(fake,uid);}catch(error){denied=(error as {status:number}).status===404;}
    assert(denied);
  }
  assert(sourceReads===0);
});

Deno.test("mail diagnostics expose only allowlisted stage and type, never arbitrary error text or code", () => {
  const secret="PRIVATE_ADDRESS_AND_PASSWORD";
  const error=mailboxError({name:"TypeError",message:secret,code:secret},"list");
  assert(error.message.includes("MAIL3/list/TypeError/other"));
  assert(!error.message.includes(secret));
  assert(!mailboxError({name:secret,code:secret,message:secret},secret).message.includes(secret));
});
Deno.test("malformed envelope recipients and invalid dates do not break a filtered inbox", async () => {
  const fake = {
    mailbox:{exists:2},
    fetch:async function*(){
      yield {uid:1,envelope:{to:[null,{address:17}]}};
      yield {uid:2,envelope:{to:[null,{address:"adam@adampruska.cz"}],date:"invalid-date"}};
    },
  } as unknown as Parameters<typeof readWebsiteMail>[0];
  const result=await readWebsiteMail(fake);
  assert(result.messages?.length===1 && result.messages[0].date==="");
});

Deno.test("mail deployment probe denies missing and non-service credentials before opening any socket", async () => {
  for(const token of ["", "not-a-service-token"]) {
    const response=await handle(new Request(url+"/mail/verify-transport",{method:"POST",headers:token?{Authorization:`Bearer ${token}`}:{}}));
    assert(response.status===401); await response.body?.cancel();
  }
});

function wireFixture(input:string, fragment=13) {
  let offset=0;const bytes=new TextEncoder().encode(input);const writes:Uint8Array[]=[];let closed=false;
  return {wire:new MailWire({read:async buffer=>{const count=Math.min(fragment,buffer.length,bytes.length-offset);if(!count)return null;buffer.set(bytes.subarray(offset,offset+count));offset+=count;return count;},write:async data=>{writes.push(data.slice());return data.length;},close:()=>{closed=true;}}),text:()=>writes.map(item=>new TextDecoder().decode(item)).join(""),closed:()=>closed};
}
Deno.test("native IMAP handles fragmented literal headers, special Sent folders and never marks a fetched message read", async()=>{
  const headers="From: Client <client@example.test>\r\nTo: adam@adampruska.cz\r\nSubject: Fixture mail\r\nDate: Mon, 19 Oct 2026 12:00:00 +0200\r\n\r\n";
  const length=new TextEncoder().encode(headers).length;
  const fixture=wireFixture(`* OK ready\r\nA1 OK login\r\n* 1 EXISTS\r\n* OK [UIDVALIDITY 99] valid\r\nA2 OK selected\r\n* 1 FETCH (UID 42 RFC822.SIZE 900 FLAGS () BODY[HEADER.FIELDS (FROM TO CC SUBJECT DATE)] {${length}}\r\n${headers})\r\nA3 OK fetched\r\n* LIST (\\Sent) "/" "Sent Messages"\r\nA4 OK folders\r\n* 3 EXISTS\r\nA5 OK selected\r\n`,3);
  const client=await NativeImap.open("fixture@me.com","fixture-password",async()=>fixture.wire);
  await client.select("inbox");
  const result=await readWebsiteMail(client);
  assert(result.messages?.length===1 && result.messages[0].uid===42);
  assert(result.messages![0].subject==="Fixture mail");
  await client.select("sent");assert(client.mailbox && client.mailbox.exists===3);
  assert(fixture.text().includes('EXAMINE "Sent Messages"'));
  assert(fixture.text().includes("BODY.PEEK[HEADER.FIELDS"));
  assert(!fixture.text().includes(" STORE "));
  client.close();assert(fixture.closed());
});
Deno.test("sent mail filtering includes website sender only, contact filter and pagination do not expose personal messages",async()=>{
  const rows=Array.from({length:70},(_,i)=>({seq:i+1,uid:i+100,envelope:{from:[{address:i%2?"adam@adampruska.cz":"private@me.com"}],to:[{address:"client@example.test"}]},flags:new Set()}));
  const client={mailbox:{exists:70},fetch:async function*(range:string){const [a,b]=range.split(":").map(Number);yield*rows.slice(a-1,b);}} as unknown as Parameters<typeof readWebsiteMail>[0];
  const first=await readWebsiteMail(client,undefined,{folder:"sent",contact:"client@example.test"});
  assert(first.messages?.length===25 && first.messages.every(row=>row.from==="adam@adampruska.cz"));
  assert(first.nextCursor===20);
  const second=await readWebsiteMail(client,undefined,{folder:"sent",cursor:first.nextCursor!});
  assert(second.messages?.length===10 && second.nextCursor===null);
  assert(!second.messages!.some(row=>first.messages!.some(old=>old.uid===row.uid)));
});
Deno.test("native SMTP generates valid Czech MIME, fixes sender, threads replies and submits only after authentication",async()=>{
  const message={...mailMessage,subject:"Přihláška a konzultace",text:"Dobrý den,\nzkouška.",inReplyTo:"<parent@example.test>",references:"<parent@example.test>"};
  const source=mailSource(message);const parsed=await PostalMime.parse(source);
  assert(parsed.from?.address==="adam@adampruska.cz" && parsed.subject===message.subject);
  assert(parsed.text?.includes("Dobrý den") && parsed.inReplyTo===message.inReplyTo);
  const fixture=wireFixture("220 ready\r\n250-host\r\n250 AUTH PLAIN\r\n235 authenticated\r\n250 sender\r\n250 recipient\r\n354 data\r\n250 queued\r\n");
  await submitSmtp("fixture@me.com","fixture-password",message,source,async(host,port)=>{assert(host==="smtp.mail.me.com" && port===465);return fixture.wire;});
  const sent=fixture.text();assert(sent.indexOf("AUTH PLAIN")<sent.indexOf("MAIL FROM"));
  assert(sent.includes("MAIL FROM:<adam@adampruska.cz>"));assert(sent.endsWith(".\r\nQUIT\r\n"));
});
Deno.test("SMTP rejection and a connection loss after DATA have distinct delivery certainty; no automatic retry",async()=>{
  for(const [response,uncertain] of [["220 ready\r\n250 host\r\n535 auth rejected\r\n",false],["220 ready\r\n250 host\r\n235 auth\r\n250 sender\r\n250 recipient\r\n354 data\r\n",true],["220 ready\r\n250 host\r\n235 auth\r\n250 sender\r\n250 recipient\r\n354 data\r\n550 refused\r\n",false]] as const) {
    const fixture=wireFixture(response);let error:unknown;
    try{await submitSmtp("fixture","password",mailMessage,mailSource(mailMessage),async()=>fixture.wire);}catch(e){error=e;}
    assert(error instanceof SmtpFailure && error.uncertain===uncertain);
    assert((fixture.text().match(/AUTH PLAIN/g)||[]).length===1 && fixture.closed());
  }
});
Deno.test("accepted iCloud SMTP is never retried if saving the Sent copy fails",()=>withMailFixture(async()=>{
  const original=globalThis.fetch;let submits=0;const states:string[]=[];
  globalThis.fetch=async(input,init)=>{assert(String(input).includes("/rest/v1/mail_outbox"));const body=JSON.parse(String(init?.body));states.push(body.status);return new Response(null,{status:201});};
  try {
    const result=await sendIcloudMail(mailMessage,{submit:async()=>{submits++;},open:async()=>{throw new Error("private diagnostics");}});
    assert(result.status==="sent" && result.warning?.includes("Kopii"));assert(submits===1 && states.join(",")==="sending,sent");
    assert(!result.warning?.includes("private"));
  }finally{globalThis.fetch=original;}
}));

Deno.test("native iCloud sends use existing app credentials and never require a Resend key",()=>withMailFixture(()=>{
  Deno.env.delete("MAIL_DELIVERY_PROVIDER");Deno.env.delete("RESEND_API_KEY");Deno.env.set("ICLOUD_SMTP_DIRECT","true");
  const status=mailStatus();assert(status.mail_send && status.mail_read && status.mail_transport==="icloud_smtp");
  Deno.env.delete("ICLOUD_APP_PASSWORD");assert(!mailStatus().mail_send);
}));

Deno.test("drafts use the Drafts special folder and Draft flag, never the Sent folder",async()=>{
  const fixture=wireFixture('* OK ready\r\nA1 OK login\r\n* LIST (\\Sent) "/" "Sent Messages"\r\n* LIST (\\Drafts) "/" "Drafts"\r\nA2 OK folders\r\n+ Ready for literal\r\nA3 OK [APPENDUID 10 42] appended\r\n');
  const client=await NativeImap.open("fixture@me.com","password",async()=>fixture.wire);
  await client.appendTo("drafts",new TextEncoder().encode("test MIME\r\n"));
  assert(fixture.text().includes('APPEND "Drafts" (\\Draft \\Seen)'));
  assert(!fixture.text().includes('APPEND "Sent Messages"'));
  client.close();
});

Deno.test("relay sends only validated message fields over HTTPS with a server-only credential",()=>withMailFixture(async()=>{
  const previousUrl=Deno.env.get("MAIL_RELAY_URL"),previousKey=Deno.env.get("MAIL_RELAY_SECRET"),original=globalThis.fetch;
  Deno.env.delete("MAIL_DELIVERY_PROVIDER");Deno.env.set("MAIL_RELAY_URL","https://relay.example.test");Deno.env.set("MAIL_RELAY_SECRET","fixture-private-relay-secret-long-enough");
  let calls=0;
  globalThis.fetch=async(input,init)=>{calls++;assert(String(input)==="https://relay.example.test/send");assert(new Headers(init?.headers).get("Authorization")==="Bearer fixture-private-relay-secret-long-enough");const body=JSON.parse(String(init?.body));assert(body.to===mailMessage.to && !JSON.stringify(body).includes("fixture-password"));return Response.json({status:"sent"});};
  try{assert(mailStatus().mail_send && mailStatus().mail_transport==="icloud_relay");await deliverIcloud("private@me.com","fixture-password",mailMessage,mailSource(mailMessage));assert(calls===1);}
  finally{globalThis.fetch=original;if(previousUrl===undefined)Deno.env.delete("MAIL_RELAY_URL");else Deno.env.set("MAIL_RELAY_URL",previousUrl);if(previousKey===undefined)Deno.env.delete("MAIL_RELAY_SECRET");else Deno.env.set("MAIL_RELAY_SECRET",previousKey);}
}));
Deno.test("mail writes require administrator authorization before parsing input or contacting services",async()=>{
  for(const path of ["/mail/draft","/mail/seen","/mail/sync-sent"]) {
    const response=await handle(new Request(url+path,{method:"POST",body:"not-json"}));assert(response.status===401);await response.body?.cancel();
  }
});
