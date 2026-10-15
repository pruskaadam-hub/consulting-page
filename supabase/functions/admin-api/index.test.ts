import { handle } from "./index.ts";
import { limitedText } from "../_shared/http.ts";
import { mailStatus, sendMail } from "../_shared/mail.ts";
import { analyticsConfigured, analyticsReport } from "../_shared/google.ts";
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
            success_url: "https://other.example/",
          }),
        }),
      );
      assert(response.status === 200);
      await response.body?.cancel();
      assert(checkout);
    } finally {
      globalThis.fetch = original;
    }
  },
);
