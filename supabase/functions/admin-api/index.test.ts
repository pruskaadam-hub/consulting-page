import { handle } from "./index.ts";
import { limitedText } from "../_shared/http.ts";
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
      assert(calls === 0);
    } finally {
      globalThis.fetch = original;
    }
  },
);
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
      if (target.includes("/auth/v1/user"))
        return Promise.resolve(
          Response.json({ id, email: "fixture@example.test" }),
        );
      if (target.includes("/rpc/is_admin"))
        return Promise.resolve(Response.json(true));
      if (target.includes("/rpc/begin_checkout"))
        return Promise.resolve(Response.json({ id }));
      if (target.includes("/rest/v1/orders"))
        return Promise.resolve(
          Response.json({
            id,
            status: "pending",
            description: "Consultation",
            amount_minor: 180000,
            clients: { email: "client@example.test" },
          }),
        );
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
