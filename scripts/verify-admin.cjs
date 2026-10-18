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
          VITE_CAL_USERNAME: "adam-pruska",
          VITE_CAL_INTRO_SLUG: "nezavazna-konzultace",
          VITE_CAL_INDIVIDUAL_SLUG: "individualni-konzultace",
          VITE_CAL_PACKAGE_SLUG: "individualni-konzultace",
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
    let mailRead = true, mailSend = true;
    let failDirectInvoice = true;
    const directRequests = [];
    let current = owner,
      level = "aal1",
      privateReads = 0,
      sends = 0,
      events = [],
      gaRequests = 0;
    const calBookings = [];
    const clients = [],
      invoices = [],
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
      registration:"Fyzická osoba zapsaná v živnostenském rejstříku",
      brand_name:"Adam Pruška",logo_style:"site",accent_color:"#d7202b",website:"https://adampruska.cz",
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
        if(u.pathname.endsWith('/admin-api/cal/sync')) {
          if(!calBookings.length)calBookings.push({uid:'cal-fixture',name:'Booking Fixture',email:'booking@example.test',title:'Individuální konzultace',starts_at:'2030-06-01T10:00:00Z',status:'accepted'});
          return ok({synced:1,syncedAt:new Date().toISOString(),hasMore:false});
        }
        if(u.pathname.endsWith('/admin-api/cal/communication'))return ok({calendarEmail:'host@example.test',calendarUsername:'fixture-host',sender:'adam@adampruska.cz',mailRead:true,mailSend:true,mailProvider:'icloud',confirmationProvider:'cal.com',managementLinkEmail:false});

        if (method === "GET" && u.pathname.endsWith("/admin-api/cal/slots"))
          return ok({ status: "success", data: {} });
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
              bookings: calBookings.length,
            });
          if (name === "rpc/issue_invoice_draft") {
            const body=req.postDataJSON(),data=body.p_data;
            if(!data.order_id) {
              directRequests.push(body);
              if(failDirectInvoice) {failDirectInvoice=false;return ok({message:"Complete billing identities and VAT status first",code:"P0001"},400);}
            }
            let contact=clients.find(c=>c.id===data.client_id);
            const recipient={...data.recipient,name:data.recipient.client_type==="company" ? data.recipient.company_name : `${data.recipient.first_name} ${data.recipient.last_name}`.trim()};
            if(contact)Object.assign(contact,recipient);
            else {contact={id:crypto.randomUUID(),...recipient};clients.push(contact);}
            Object.assign(business,data.supplier);
            let order=orders.find(o=>o.id===data.order_id);
            if(!order) {order={id:body.p_request,client_id:contact.id,description:data.name,service_details:data.details,
              amount_minor:data.amount_minor,status:"pending",source:"manual",is_test:false,created_at:new Date().toISOString(),clients:{name:contact.name,email:contact.email}};orders.push(order);}
            const net=Math.round(order.amount_minor/(1+data.tax_rate/100));
            const item={id:crypto.randomUUID(),number:`2026${String(invoices.length+1).padStart(5,"0")}`,order_id:order.id,
              issue_date:"2026-10-15",due_date:data.due_date,supply_date:data.supply_date,supplier:JSON.parse(JSON.stringify(business)),recipient:JSON.parse(JSON.stringify(contact)),
              description:order.description,service_details:order.service_details,amount_minor:order.amount_minor,net_minor:net,tax_minor:order.amount_minor-net,tax_rate:data.tax_rate,tax_note:data.tax_note};
            invoices.push(item);return ok(item);
          }
          if (name === "rpc/analytics_summary")
            return ok({ events: [], days: [] });
          if (name === "business_settings") return ok(business);
          const rows = {
            clients,
            orders,
            tasks,
            bookings: calBookings,
            invoices: invoices.map((item) => ({...item, orders:{status: orders.find((order) => order.id === item.order_id)?.status}})),
            stripe_invoices: orders.filter((o) => o.is_test).map((o) => ({
              id: "in_test_fixture", number: "TEST-1", status: "paid",
              amount_minor: o.amount_minor, is_test: true,
            })),
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
          if (method === "PATCH") {
            assert.equal(name, "orders");
            const row = rows.find((item) => item.id === u.searchParams.get("id")?.replace("eq.", ""));
            assert.equal(row.source, "manual");
            Object.assign(row, req.postDataJSON());
            return ok(null);
          }
          return ok(rows);
        }
        if (u.pathname.endsWith("/admin-api/events")) {
          events.push(req.postDataJSON());
          return ok({ accepted: true }, 202);
        }
        if (u.pathname.endsWith("/admin-api/status"))
          return ok({
            mail: mailRead && mailSend,
            mail_read: mailRead,
            mail_send: mailSend,
            mail_provider: "icloud",
            analytics: false,
            payment_mode: "offline",
            payments: false,
            invoicing: false,
            tax: false,
            stripe_mode: "test",
            bookings: true,
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
    await page.getByRole("navigation",{name:"Administrace"}).getByRole("button",{name:"Rezervace",exact:true}).click();
    await page.getByRole('cell',{name:/Booking Fixture/}).waitFor();
    await page.getByRole('button',{name:'Načíst rezervace z Cal.com',exact:true}).click();
    await page.getByRole('button',{name:'Ověřit e-mailovou komunikaci',exact:true}).click();
    await page.getByText('host@example.test',{exact:true}).waitFor();
    await validate('Cal communication and imported booking');
    await page.getByRole("navigation", {name:"Administrace"}).getByRole("button", {name:"Faktury",exact:true}).click();
    await page.getByLabel("Existující objednávka", {exact:true}).check();
    assert.equal(await page.getByLabel("Objednávka k fakturaci", {exact:true}).isDisabled(), true);
    assert.equal(await page.getByRole("button", {name:"Vystavit fakturu",exact:true}).isDisabled(), true);
    await page.getByText("Mezi posledními 100 objednávkami není žádná", {exact:false}).waitFor();
    await page.getByLabel("Nová konzultace nebo služba", {exact:true}).check();
    await page.getByRole("navigation", {name:"Administrace"}).getByRole("button", {name:"Klienti",exact:true}).click();
    await page.getByLabel("Jméno nebo firma").fill("Client Test");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("client@example.test");
    await page.getByLabel("Fakturační adresa včetně země", {exact:true}).fill("Praha, Česká republika");
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
    assert.equal(await page.getByRole("button", {name: "Platební odkaz", exact: true}).count(), 0);
    await page.getByRole("navigation", {name: "Administrace"})
      .getByRole("button", {name: "Faktury", exact: true}).click();
    assert.equal(await page.getByRole("heading", {name: "Faktury Stripe", exact: true}).count(), 0);
    await page.getByLabel("Existující objednávka", {exact:true}).check();
    await page.locator('select[name="order_id"]').selectOption(orders[0].id);
    await page.getByLabel("Země klienta", {exact:true}).selectOption("CZ");
    await page.getByLabel("Datum splatnosti", {exact: true}).fill("2030-12-31");
    await page.getByRole("button", {name: "Vystavit fakturu", exact: true}).click();
    await page.getByRole("region", {name: "Faktura 202600001", exact: true}).waitFor();
    await page.getByRole("button", {name: "Tisk / uložit PDF", exact: true}).waitFor();
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0].due_date, "2030-12-31");
    await page.getByRole("navigation", {name: "Administrace"})
      .getByRole("button", {name: "Objednávky", exact: true}).click();
    await page.getByRole("button", {name: "Označit ručně uhrazené", exact: true}).click();
    await page.getByRole("status").filter({hasText: "Uloženo."}).waitFor();
    assert.equal(orders[0].status, "paid");
    await page.getByRole("navigation", {name: "Administrace"})
      .getByRole("button", {name: "Faktury", exact: true}).click();
    await page.locator(".admin-list-row").filter({hasText:"202600001"}).getByText("Uhrazeno", {exact: true}).waitFor();
    await page.getByLabel("Nová konzultace nebo služba", {exact:true}).check();
    const invoiceService = page.getByLabel("Konzultace nebo vlastní služba", {exact:true});
    for (const [id,price] of [["individual","1800"],["student","1500"],["package","4500"],["student-package","3500"]]) {
      await invoiceService.selectOption(id);
      assert.equal(await page.getByLabel("Celková cena služby v Kč", {exact:true}).inputValue(), price);
    }
    await invoiceService.selectOption("custom");
    await page.getByLabel("Klient pro fakturu", {exact:true}).selectOption(clients[0].id);
    await page.getByLabel("Název služby", {exact:true}).fill("Úprava CV a dokumentů");
    const customDetails = "Rozbor CV\nDoporučení pro <švýcarský trh> a pohovory.";
    await page.getByLabel("Podrobný popis služby", {exact:true}).fill(customDetails);
    await page.getByLabel("Celková cena služby v Kč", {exact:true}).fill("0");
    await page.getByRole("button", {name:"Vystavit fakturu",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Zadej částku"}).waitFor();
    assert.equal(directRequests.length,0);
    await page.getByLabel("Celková cena služby v Kč", {exact:true}).fill("2500,50");
    await page.getByLabel("Datum splatnosti", {exact:true}).fill("2030-12-31");
    await page.getByRole("button", {name:"Vystavit fakturu",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Údaje formuláře zůstaly zachované"}).waitFor();
    assert.equal(invoices.length,1);
    assert.equal(orders.length,1);
    assert.equal(await page.getByLabel("Podrobný popis služby", {exact:true}).inputValue(),customDetails);
    await page.getByRole("button", {name:"Vystavit fakturu",exact:true}).click();
    const customInvoice = page.getByRole("region", {name:"Faktura 202600002",exact:true});
    await customInvoice.waitFor();
    assert.equal(directRequests.length,2);
    assert.equal(directRequests[0].p_request,directRequests[1].p_request);
    assert.equal(invoices.length,2);
    assert.equal(orders.length,2);
    assert.equal(invoices[1].amount_minor,250050);
    assert.equal(await customInvoice.locator(".admin-service-details").innerText(),customDetails);
    await validate("custom service invoice");
    await page.emulateMedia({media:"print"});
    assert.equal(await customInvoice.isVisible(),true);
    assert.equal(await page.locator(".admin-panel").first().isVisible(),false);
    const pdf=await page.pdf({format:"A4"});
    assert.equal(pdf.subarray(0,5).toString(),"%PDF-");
    await page.emulateMedia({media:"screen"});
    await page.getByLabel("Klient pro fakturu", {exact:true}).selectOption("new");
    await page.getByLabel("Typ odběratele", {exact:true}).selectOption("company");
    await page.getByLabel("Jméno klienta", {exact:true}).fill("Eva");
    await page.getByLabel("Příjmení klienta", {exact:true}).fill("Nová");
    await page.getByLabel("Název firmy klienta", {exact:true}).fill("Nová firma s.r.o.");
    await page.getByLabel("IČO firmy / zahraniční identifikátor", {exact:true}).fill("87654321");
    await page.getByLabel("E-mail klienta", {exact:true}).fill("nova-firma@example.test");
    await page.getByLabel("Fakturační adresa klienta (ulice, město, PSČ)", {exact:true}).fill("Nová 5, 110 00 Praha");
    await page.getByLabel("Web klienta (volitelný)", {exact:true}).fill("https://example.test/firma");
    await page.getByLabel("Klient je plátce DPH", {exact:true}).check();
    await page.getByLabel("DIČ klienta", {exact:true}).fill("CZ87654321");
    if(!await page.locator(".invoice-supplier-editor").evaluate(e=>e.open)) await page.getByText("Údaje mé firmy a vzhled faktury", {exact:true}).click();
    await page.getByLabel("Název značky na faktuře", {exact:true}).fill("AP test brand");
    await page.getByLabel("Logo na faktuře", {exact:true}).selectOption("original");
    await page.getByLabel("Dodavatel: plátcovství DPH", {exact:true}).selectOption("yes");
    await page.getByLabel("Dodavatel: DIČ", {exact:true}).fill("CZ12345678");
    assert.equal(await page.getByLabel("Sazba DPH", {exact:true}).inputValue(),"21");
    await page.getByLabel("Sazba DPH", {exact:true}).selectOption("0");
    assert.equal(await page.getByLabel("Důvod nulové DPH a právní ustanovení", {exact:true}).evaluate(e=>e.required),true);
    await page.getByLabel("Důvod nulové DPH a právní ustanovení", {exact:true}).fill("Testovací popis režimu a ustanovení");
    await page.getByLabel("Sazba DPH", {exact:true}).selectOption("21");
    const live=page.getByRole("region", {name:"Náhled faktury",exact:true});
    await live.getByText("Nová firma s.r.o.", {exact:true}).waitFor();
    await live.getByText("AP test brand", {exact:true}).waitFor();
    assert.equal(await live.locator("img").count(),1);
    assert.match(await page.getByLabel("Klient pro fakturu", {exact:true}).evaluate(e=>getComputedStyle(e).backgroundPosition),/15px/);
    for(const width of [375,1280]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"invoice editor overflow");
    }
    await page.getByRole("button", {name:"Vystavit fakturu",exact:true}).click();
    const companyDoc=page.getByRole("region", {name:"Faktura 202600003",exact:true});await companyDoc.waitFor();
    assert.equal(clients.length,2);
    assert.equal(clients[1].company_name,"Nová firma s.r.o.");
    assert.equal(invoices[2].supplier.brand_name,"AP test brand");
    assert.equal(invoices[2].tax_rate,21);
    assert.equal(invoices[2].tax_minor,31240);
    assert.equal(invoices[2].tax_note,"");
    await companyDoc.getByText("Daňový doklad", {exact:true}).waitFor();
    assert.equal(invoices[2].recipient.website,"https://example.test/firma");
    await companyDoc.getByText("Fyzická osoba zapsaná v živnostenském rejstříku", {exact:true}).waitFor();
    if(process.env.SCREENSHOT_DIR) await companyDoc.screenshot({path:path.join(process.env.SCREENSHOT_DIR,"invoice-document.png")});
    await validate("manual client and branded invoice");
    await page.getByRole("navigation", {name:"Administrace"}).getByRole("button", {name:"Klienti",exact:true}).click();
    await page.getByText("https://example.test/firma", {exact:true}).waitFor();
    await page.getByRole("navigation", {name:"Administrace"}).getByRole("button", {name:"Faktury",exact:true}).click();
    const overdueOrder = {...orders[0], id:crypto.randomUUID(), status:"pending", description:"Historická neuhrazená faktura"};
    orders.push(overdueOrder);
    invoices.push({...invoices[0],id:crypto.randomUUID(),number:"202000001",order_id:overdueOrder.id,issue_date:"2020-01-01",due_date:"2020-01-15"});
    orders.push({...orders[0], id:crypto.randomUUID(), description:"Stripe test record", source: "stripe", is_test: true});
    await page.reload();
    await page.getByRole("navigation", {name: "Administrace"})
      .getByRole("button", {name: "Objednávky", exact: true}).click();
    assert.equal(await page.getByText("Stripe je v testovacím režimu.", {exact: false}).count(), 0);
    await page.getByText("Testovací platba", {exact: true}).waitFor();
    assert.equal(await page.getByRole("row").filter({hasText:"Stripe test record"}).getByRole("button", {name: "Označit ručně uhrazené", exact: true}).count(), 0);
    await page.getByRole("navigation", {name: "Administrace"})
      .getByRole("button", {name: "Faktury", exact: true}).click();
    await page.getByText("Testovací faktura", {exact: true}).waitFor();
    await page.getByText("Po splatnosti", {exact: true}).waitFor();
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
    for (const [read, send] of [[false, true], [true, false]]) {
      mailRead = read;
      mailSend = send;
      await page.reload();
      await page.getByRole("navigation", { name: "Administrace" })
        .getByRole("button", { name: "Pošta", exact: true }).click();
      if (read) await page.getByRole("button", { name: "Načíst posledních 25 zpráv" }).waitFor();
      else await page.getByText("Příjem pošty zatím není připojený.", { exact: false }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Načíst posledních 25 zpráv" }).count(), read ? 1 : 0);
      const submit = page.getByRole("button", { name: "Odeslat zprávu" });
      if (send) await submit.waitFor();
      else await page.getByText("Odesílání zatím není připojené.", { exact: false }).waitFor();
      assert.equal(await submit.isDisabled(), !send);
    }
    mailRead = mailSend = true;
    await page.reload();
    await page.getByRole("navigation", { name: "Administrace" }).waitFor();
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
      "PASS: owner-only login and MFA, protected dashboard and CRUD, all 9 admin sections at 375/1280px, manual invoice clients and live brand/VAT preview, PDF, plain-text mailbox, mocked send, logout, consent before any analytics and withdrawal. No real provider operations.",
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
