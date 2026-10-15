// Isolated fixture builds: no production requests, emails, payments or bookings.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { HtmlValidate } = require("html-validate");
(async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "consulting-admin-"),
  );
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  let server;
  try {
    const fixture = path.join(temporary, "fixture");
    const result = spawnSync(
      process.execPath,
      ["scripts/build-site.mjs", "--outDir", fixture],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          VITE_SITE_URL: "https://adampruska.cz/",
          VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only",
          VITE_SUPABASE_URL: "https://lsofzsartjesgwetcpzw.supabase.co",
          VITE_ENABLE_EVENTS: "true",
          VITE_GA4_MEASUREMENT_ID: "G-FIXTUREONLY",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url, "http://localhost");
        let relative = decodeURIComponent(u.pathname);
        if (relative.endsWith("/")) relative += "index.html";
        const file = path.resolve(fixture, "." + relative);
        if (!file.startsWith(fixture + path.sep)) throw new Error("path");
        const content = await fs.readFile(file);
        res.writeHead(200, {
          "Content-Type":
            {
              ".html": "text/html",
              ".css": "text/css",
              ".js": "text/javascript",
              ".svg": "image/svg+xml",
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".png": "image/png",
            }[path.extname(file)] || "application/octet-stream",
        });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("Admin page error:", error.message);
    });
    const owner = "11111111-1111-4111-8111-111111111111",
      other = "22222222-2222-4222-8222-222222222222",
      factor = "33333333-3333-4333-8333-333333333333";
    let current = owner,
      level = "aal1",
      privateReads = 0,
      sends = 0,
      events = [],
      gaRequests = 0;
    const clients = [],
      orders = [],
      tasks = [];
    const business = {
      id: true,
      legal_name: "Test Supplier",
      ico: "12345678",
      address: "Praha, Česká republika",
      bank_account: "123/0100",
      vat_registered: false,
      vat_id: "",
      invoice_note: "",
    };
    const user = () => ({
      id: current,
      email: current === owner ? "pruskaadam@me.com" : "other@example.test",
      aud: "authenticated",
      role: "authenticated",
      created_at: new Date().toISOString(),
      factors: [
        {
          id: factor,
          factor_type: "totp",
          friendly_name: "Fixture",
          status: "verified",
        },
      ],
    });
    const token = () =>
      [
        Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
        Buffer.from(
          JSON.stringify({
            sub: current,
            role: "authenticated",
            aal: level,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          }),
        ).toString("base64url"),
        "fixture-signature",
      ].join(".");
    const session = () => ({
      access_token: token(),
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: user(),
    });
    await page.route("https://api.cal.com/**", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ status: "success", data: {} }),
      }),
    );
    await page.route("https://www.googletagmanager.com/**", (r) => {
      gaRequests++;
      return r.fulfill({ contentType: "application/javascript", body: "" });
    });
    await page.route(
      "https://lsofzsartjesgwetcpzw.supabase.co/**",
      async (route) => {
        const req = route.request(),
          u = new URL(req.url()),
          method = req.method();
        const ok = (value, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "*",
            },
            body: JSON.stringify(value),
          });
        if (method === "OPTIONS") return ok({}, 204);
        if (u.pathname.endsWith("/auth/v1/token")) {
          const body = req.postDataJSON();
          if (body.password === "wrong")
            return ok(
              {
                error: "invalid_grant",
                error_description: "Invalid login credentials",
              },
              400,
            );
          current = body.email === "other@example.test" ? other : owner;
          level = "aal1";
          return ok(session());
        }
        if (u.pathname.endsWith("/auth/v1/logout")) return ok({});
        if (u.pathname.endsWith("/auth/v1/user")) return ok(user());
        if (u.pathname.endsWith("/challenge"))
          return ok({
            id: "fixture-challenge",
            type: "totp",
            expires_at: Math.floor(Date.now() / 1000) + 300,
          });
        if (u.pathname.endsWith("/verify")) {
          assert.equal(req.postDataJSON().code, "123456");
          level = "aal2";
          return ok(session());
        }
        if (u.pathname.startsWith("/rest/v1/")) {
          const name = u.pathname.slice("/rest/v1/".length);
          if (name === "admin_users")
            return ok(current === owner ? [{ user_id: owner }] : []);
          if (name === "rpc/is_admin")
            return ok(current === owner && level === "aal2");
          privateReads++;
          assert.equal(current, owner, "only owner requests private data");
          assert.equal(level, "aal2", "MFA precedes data requests");
          if (name === "rpc/business_summary")
            return ok({
              revenue: 0,
              month_revenue: 0,
              pending: orders.length,
              clients: clients.length,
              bookings: 0,
            });
          if (name === "rpc/analytics_summary")
            return ok({ events: [], days: [] });
          if (name === "business_settings") return ok(business);
          const rows = {
            clients,
            orders,
            tasks,
            bookings: [],
            invoices: [],
            stripe_invoices: [],
            mail_outbox: [],
          }[name];
          assert.ok(rows, `unexpected table ${name}`);
          if (method === "POST") {
            const body = req.postDataJSON();
            if (name === "orders") assert.equal(body.amount_minor, 150000);
            rows.push({
              id: crypto.randomUUID(),
              ...body,
              created_at: new Date().toISOString(),
              clients: { name: "Client Test", email: "client@example.test" },
              status: "pending",
              source: "manual",
            });
            return ok(null, 201);
          }
          return ok(rows);
        }
        if (u.pathname.endsWith("/admin-api/events")) {
          events.push(req.postDataJSON());
          return ok({ accepted: true }, 202);
        }
        if (u.pathname.endsWith("/admin-api/status"))
          return ok({
            mail: true,
            analytics: false,
            payments: false,
            invoicing: false,
            tax: false,
            stripe_mode: "test",
            bookings: false,
            events: true,
            mailbox: "adam@adampruska.cz",
          });
        if (u.pathname.endsWith("/admin-api/mail")) {
          if (method === "POST") {
            sends++;
            return ok({ status: "sent" });
          }
          if (u.searchParams.has("uid"))
            return ok({
              uid: 1,
              subject: "Fixture email",
              from: "client@example.test",
              text: 'Plain text <img src="https://tracker.invalid/x" onerror="alert(1)">',
              attachments: [],
            });
          return ok({
            messages: [
              {
                uid: 1,
                subject: "Fixture email",
                from: "client@example.test",
                date: new Date().toISOString(),
              },
            ],
          });
        }
        throw new Error("Unexpected provider request: " + u.pathname);
      },
    );
    const validator = new HtmlValidate(require("../.htmlvalidate.json"));
    async function validate(label) {
      const report = await validator.validateString(await page.content());
      assert.equal(
        report.valid,
        true,
        label +
          ": " +
          JSON.stringify(report.results.flatMap((r) => r.messages)),
      );
    }
    await page.goto(base + "/admin/", { waitUntil: "networkidle" });
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex, nofollow",
    );
    assert.equal(privateReads, 0);
    assert.equal(events.length, 0);
    assert.equal(gaRequests, 0);
    await page.getByLabel("Heslo", { exact: true }).fill("wrong");
    await page
      .getByRole("button", { name: "Přihlásit se", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    assert.equal(privateReads, 0);
    await page.getByLabel("E-mail správce").fill("other@example.test");
    await page.getByLabel("Heslo", { exact: true }).fill("fixture-password");
    await page
      .getByRole("button", { name: "Přihlásit se", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Přihlásit se jiným účtem" })
      .waitFor();
    assert.equal(privateReads, 0);
    await page
      .getByRole("button", { name: "Přihlásit se jiným účtem" })
      .click();
    await page.getByLabel("E-mail správce").fill("pruskaadam@me.com");
    await page.getByLabel("Heslo", { exact: true }).fill("fixture-password");
    await page
      .getByRole("button", { name: "Přihlásit se", exact: true })
      .click();
    await page.getByLabel("Kód z ověřovací aplikace").waitFor();
    assert.equal(privateReads, 0);
    await validate("MFA gate");
    await page.getByLabel("Kód z ověřovací aplikace").fill("123456");
    await page.getByRole("button", { name: "Otevřít administraci" }).click();
    await page.getByRole("heading", { name: "Ahoj, Adame." }).waitFor();
    await validate("overview");
    for (const name of [
      "Návštěvnost",
      "Rezervace",
      "Klienti",
      "Objednávky",
      "Faktury",
      "Pošta",
      "Úkoly",
      "Nastavení",
    ]) {
      await page
        .getByRole("navigation", { name: "Administrace" })
        .getByRole("button", { name, exact: true })
        .click();
      await validate(name);
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          name + " overflow",
        );
      }
    }
    await page
      .getByRole("navigation", { name: "Administrace" })
      .getByRole("button", { name: "Klienti", exact: true })
      .click();
    await page.getByLabel("Jméno nebo firma").fill("Client Test");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("client@example.test");
    await page.getByRole("button", { name: "Uložit klienta" }).click();
    await page.getByRole("status").filter({ hasText: "Uloženo." }).waitFor();
    assert.equal(clients.length, 1);
    await page
      .getByRole("navigation", { name: "Administrace" })
      .getByRole("button", { name: "Objednávky", exact: true })
      .click();
    await page.locator('select[name="client_id"]').selectOption(clients[0].id);
    await page
      .getByLabel("Popis služby")
      .fill("Individuální konzultace pro studenty");
    await page.getByLabel("Celková cena v Kč").fill("1500");
    await page.getByRole("button", { name: "Vytvořit objednávku" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Objednávka byla vytvořena." })
      .waitFor();
    assert.equal(orders.length, 1);
    await page
      .getByRole("navigation", { name: "Administrace" })
      .getByRole("button", { name: "Pošta", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Načíst posledních 25 zpráv" })
      .click();
    await page.getByRole("button", { name: /Fixture email/ }).click();
    await page.locator(".admin-mail-message pre").waitFor();
    assert.match(
      await page.locator(".admin-mail-message pre").innerText(),
      /<img/,
    );
    assert.equal(await page.locator('img[src*="tracker.invalid"]').count(), 0);
    await page.getByRole("button", { name: "Odpovědět", exact: true }).click();
    await page
      .getByLabel("Zpráva", { exact: true })
      .fill("Fixture only, never sent.");
    await page.getByRole("button", { name: "Odeslat zprávu" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "přijata poštovním serverem" })
      .waitFor();
    assert.equal(sends, 1);
    assert.equal(events.length, 0);
    if (process.env.SCREENSHOT_DIR) {
      await fs.mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      await page
        .getByRole("navigation", { name: "Administrace" })
        .getByRole("button", { name: "Přehled", exact: true })
        .click();
      await page.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, "admin-desktop.png"),
      });
      await page.setViewportSize({ width: 375, height: 850 });
      await page.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, "admin-mobile.png"),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: /^Odhlásit se/ }).click();
    await page.getByLabel("Heslo", { exact: true }).waitFor();
    assert.equal(await page.locator(".admin-main").count(), 0);
    await page.goto(base + "/", { waitUntil: "networkidle" });
    assert.equal(events.length, 0);
    assert.equal(gaRequests, 0);
    await page.getByRole("button", { name: "Bez měření", exact: true }).click();
    await page.locator(".hero-copy .button").click();
    assert.equal(events.length, 0);
    assert.equal(gaRequests, 0);
    await page
      .getByRole("button", { name: "Nastavení měření", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Povolit měření", exact: true })
      .click();
    await page.waitForFunction(
      () => document.getElementById("ap-ga4") !== null,
    );
    await page.waitForTimeout(150);
    assert.equal(gaRequests, 1);
    assert.equal(events.filter((e) => e.name === "page_view").length, 1);
    assert.ok(
      events.every(
        (e) =>
          !JSON.stringify(e).includes("example.test") && !e.path.includes("?"),
      ),
    );
    await page
      .getByRole("button", { name: "Odvolat souhlas", exact: true })
      .click();
    const before = events.length;
    await page.locator(".hero-copy .button").click();
    await page.waitForTimeout(100);
    assert.equal(events.length, before);
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("ap-analytics-session")),
      null,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: owner-only login and MFA, protected dashboard and CRUD, all 9 admin sections at 375/1280px, plain-text mailbox, mocked send, logout, consent before any analytics and withdrawal. No real provider operations.",
    );
  } finally {
    await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
