import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "11111111-1111-4111-8111-111111111111",
  outsider = "22222222-2222-4222-8222-222222222222";
const pg = new PGlite();
let client, order, paymentOrder;
before(async () => {
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;
 insert into auth.users values('${owner}','pruskaadam@me.com'),('${outsider}','other@example.test');`);
  await pg.exec(
    await readFile(
      new URL("../supabase/migrations/202610150001_admin.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(await readFile(new URL("../supabase/migrations/202610150002_stripe_modes.sql", import.meta.url), "utf8"));
  await pg.exec(
    await readFile(
      new URL("../supabase/appoint-owner.sql", import.meta.url),
      "utf8",
    ),
  );
});
after(() => pg.close());
async function as(role, sub, aal, action) {
  await pg.exec("begin");
  try {
    await pg.exec(`set local role ${role}`);
    await pg.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub, aal }),
    ]);
    const result = await action();
    await pg.exec("commit");
    return result;
  } catch (e) {
    await pg.exec("rollback");
    throw e;
  }
}
test("database denies anonymous access, non-owners and an owner without MFA", async () => {
  await assert.rejects(
    as("anon", null, null, () => pg.query("select * from public.clients")),
    /permission denied/,
  );
  for (const [sub, aal] of [
    [outsider, "aal2"],
    [owner, "aal1"],
  ]) {
    await as("authenticated", sub, aal, async () =>
      assert.equal(
        (await pg.query("select * from public.clients")).rows.length,
        0,
      ),
    );
    await assert.rejects(
      as("authenticated", sub, aal, () =>
        pg.query(
          "insert into public.clients(name,email) values('Test','x@example.test')",
        ),
      ),
      /row-level security/,
    );
    await assert.rejects(
      as("authenticated", sub, aal, () =>
        pg.query(
          "select public.issue_invoice('11111111-1111-4111-8111-111111111111',0)",
        ),
      ),
      /Admin \+ MFA required/,
    );
  }
  await as("authenticated", owner, "aal1", async () =>
    assert.equal(
      (await pg.query("select * from public.admin_users")).rows.length,
      1,
    ),
  );
  await assert.rejects(
    as("authenticated", outsider, "aal2", () =>
      pg.query(`insert into public.admin_users values('${outsider}',now())`),
    ),
    /permission denied/,
  );
});
test("owner creates actual records; invoices require billing details and are immutable and idempotent", async () => {
  await as("authenticated", owner, "aal2", async () => {
    client = (
      await pg.query(
        "insert into public.clients(name,email,address) values('Test Client','client@example.test','Praha, Česká republika') returning id",
      )
    ).rows[0].id;
    order = (
      await pg.query(
        "insert into public.orders(client_id,description,amount_minor) values($1,'Konzultace',180000) returning id",
        [client],
      )
    ).rows[0].id;
  });
  await assert.rejects(
    as("authenticated", owner, "aal2", () =>
      pg.query("select public.issue_invoice($1,0)", [order]),
    ),
    /Complete billing identities/,
  );
  await as("authenticated", owner, "aal2", async () => {
    await pg.query(
      "update public.business_settings set legal_name='Test Supplier',ico='12345678',address='Praha, Česká republika',bank_account='123/0100',vat_registered=true,vat_id='CZ12345678'",
    );
    const first = (
      await pg.query("select (public.issue_invoice($1,21,'2026-10-15')).*", [
        order,
      ])
    ).rows[0];
    const repeated = (
      await pg.query("select (public.issue_invoice($1,21,'2026-10-15')).*", [
        order,
      ])
    ).rows[0];
    assert.equal(first.id, repeated.id);
    assert.equal(first.amount_minor, 180000);
    assert.equal(first.net_minor + first.tax_minor, 180000);
    assert.equal(first.net_minor, 148760);
    assert.equal(
      (await pg.query("select count(*)::int as count from public.invoices"))
        .rows[0].count,
      1,
    );
    const summary = (await pg.query("select public.business_summary() as data"))
      .rows[0].data;
    assert.equal(summary.revenue, 0);
    assert.equal(summary.pending, 1);
  });
  await assert.rejects(
    as("authenticated", owner, "aal2", () =>
      pg.query("update public.invoices set amount_minor=1"),
    ),
    /permission denied/,
  );
});
test("only service role can apply signed payments; replay and wrong amounts cannot alter revenue", async () => {
  await as("authenticated", owner, "aal2", async () => {
    paymentOrder = (await pg.query("insert into public.orders(client_id,description,amount_minor) values($1,'Live payment',180000) returning id", [client])).rows[0].id;
    await pg.query("select public.begin_checkout($1,false)", [paymentOrder]);
  });
  await assert.rejects(
    as("authenticated", owner, "aal2", () =>
      pg.query(
        "select public.apply_payment('event-1',$1,180000,'czk','session-1',false)",
        [paymentOrder],
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(
    as("service_role", null, null, () =>
      pg.query(
        "select public.apply_payment('event-1',$1,1,'czk','session-1',false)",
        [paymentOrder],
      ),
    ),
    /Payment mismatch/,
  );
  await as("service_role", null, null, async () => {
    assert.equal(
      (
        await pg.query(
          "select public.apply_payment('event-1',$1,180000,'czk','session-1',false) as applied",
          [paymentOrder],
        )
      ).rows[0].applied,
      true,
    );
    assert.equal(
      (
        await pg.query(
          "select public.apply_payment('event-1',$1,180000,'czk','session-1',false) as applied",
          [paymentOrder],
        )
      ).rows[0].applied,
      false,
    );
  });
  await as("authenticated", owner, "aal2", async () =>
    assert.equal(
      (await pg.query("select public.business_summary() as data")).rows[0].data
        .revenue,
      180000,
    ),
  );
});
test("out-of-order calendar webhooks do not resurrect cancelled reservations", async () => {
  await as("service_role", null, null, async () => {
    for (const [status, time] of [
      ["accepted", "2030-01-01"],
      ["cancelled", "2030-01-03"],
      ["accepted", "2030-01-02"],
    ])
      await pg.query(
        "select public.apply_booking('cal-1','Test','test@example.test','Consultation','2030-06-01',$1,$2)",
        [status, time],
      );
  });
  await as("authenticated", owner, "aal2", async () =>
    assert.equal(
      (await pg.query("select status from public.bookings where uid='cal-1'"))
        .rows[0].status,
      "cancelled",
    ),
  );
});
test("anonymous event rate limit is atomic and telemetry never becomes revenue", async () => {
  await as("service_role", null, null, async () => {
    for (let i = 0; i < 61; i++) {
      const event = {
        id: crypto.randomUUID(),
        name: "consultation_click",
        session_id: crypto.randomUUID(),
        path: "/",
        service: "individual",
        placement: "hero",
        language: "cs",
      };
      const result = (
        await pg.query("select public.accept_event($1,$2) as accepted", [
          "test-bucket",
          JSON.stringify(event),
        ])
      ).rows[0].accepted;
      assert.equal(result, i < 60);
    }
  });
  await as("authenticated", owner, "aal2", async () => {
    const summary = (
      await pg.query("select public.analytics_summary() as data")
    ).rows[0].data;
    assert.equal(summary.events[0].count, 60);
    assert.equal(
      (await pg.query("select public.business_summary() as data")).rows[0].data
        .revenue,
      180000,
    );
  });
});
test("Stripe order reserves its own invoice flow and verified refunds reduce net revenue", async () => {
  let stripeOrder;
  await as("authenticated", owner, "aal2", async () => {
    await assert.rejects(
      pg.query("select public.begin_checkout($1,false)", [order]),
      /Order is not payable|local invoice/,
    );
  });
  // A failed statement aborts its transaction, so use a separate transaction for the next operation.
  await as("authenticated", owner, "aal2", async () => {
    stripeOrder = (
      await pg.query(
        "insert into public.orders(client_id,description,amount_minor) values($1,'Package',450000) returning id",
        [client],
      )
    ).rows[0].id;
    await pg.query("select public.begin_checkout($1,false)", [stripeOrder]);
  });
  await assert.rejects(
    as("authenticated", owner, "aal2", () =>
      pg.query("select public.issue_invoice($1,0)", [stripeOrder]),
    ),
    /Use the Stripe invoice/,
  );
  await as("service_role", null, null, async () => {
    await pg.query(
      "select public.apply_payment('stripe-order-paid',$1,450000,'czk','session-2',false)",
      [stripeOrder],
    );
    await pg.query("select public.apply_refund('refund-partial',$1,100000,false)", [
      stripeOrder,
    ]);
    const base = {
      id: "in_fixture",
      order_id: stripeOrder,
      number: "STRIPE-1",
      status: "paid",
      amount_minor: 450000,
      tax_minor: 0,
      currency: "czk",
    };
    await pg.query("select public.apply_stripe_invoice($1,20,false)", [
      JSON.stringify(base),
    ]);
    await pg.query("select public.apply_stripe_invoice($1,10,false)", [
      JSON.stringify({ ...base, status: "open" }),
    ]);
  });
  await as("authenticated", owner, "aal2", async () => {
    assert.equal(
      (await pg.query("select public.business_summary() as data")).rows[0].data
        .revenue,
      530000,
    );
    assert.equal(
      (
        await pg.query(
          "select status from public.stripe_invoices where id='in_fixture'",
        )
      ).rows[0].status,
      "paid",
    );
  });
  await as("service_role", null, null, async () => {
    await pg.query("select public.apply_refund('refund-full',$1,450000,false)", [
      stripeOrder,
    ]);
    await pg.query("select public.apply_refund('refund-old',$1,100000,false)", [
      stripeOrder,
    ]);
  });
  await as("authenticated", owner, "aal2", async () =>
    assert.equal(
      (await pg.query("select public.business_summary() as data")).rows[0].data
        .revenue,
      180000,
    ),
  );
});

test("test Checkout stays separate from live totals and rejects mode changes and crossed webhooks", async () => {
  let testOrder;
  const summary = () => pg.query("select public.business_summary() as data");
  const before = (await as("authenticated", owner, "aal2", summary)).rows[0].data;
  await as("authenticated", owner, "aal2", async () => {
    testOrder = (await pg.query("insert into public.orders(client_id,description,amount_minor) values($1,'Test Checkout',150000) returning id", [client])).rows[0].id;
    const reserved = (await pg.query("select (public.begin_checkout($1,true)).*", [testOrder])).rows[0];
    assert.equal(reserved.is_test, true);
    assert.equal(reserved.source, "stripe");
    await pg.query("select public.begin_checkout($1,true)", [testOrder]);
    assert.deepEqual((await summary()).rows[0].data, before);
  });
  await assert.rejects(as("authenticated", owner, "aal2", () => pg.query("select public.begin_checkout($1,false)", [testOrder])), /mode mismatch/);
  await assert.rejects(as("authenticated", owner, "aal2", () => pg.query("select public.issue_invoice($1,0)", [testOrder])), /Use the Stripe invoice/);
  await assert.rejects(as("service_role", null, null, () => pg.query("select public.apply_payment('test-paid',$1,150000,'czk','cs_test_fixture',false)", [testOrder])), /Payment mismatch/);
  await as("service_role", null, null, async () => {
    assert.equal((await pg.query("select public.apply_payment('test-paid',$1,150000,'czk','cs_test_fixture',true) as applied", [testOrder])).rows[0].applied, true);
    assert.equal((await pg.query("select public.apply_payment('test-paid',$1,150000,'czk','cs_test_fixture',true) as applied", [testOrder])).rows[0].applied, false);
  });
  const invoice = JSON.stringify({id:"in_test_fixture",order_id:testOrder,status:"paid",amount_minor:150000,tax_minor:0,currency:"czk"});
  await assert.rejects(as("service_role", null, null, () => pg.query("select public.apply_stripe_invoice($1,30,false)", [invoice])), /Invoice mode mismatch/);
  await assert.rejects(as("service_role", null, null, () => pg.query("select public.apply_refund('test-refund',$1,150000,false)", [testOrder])), /Refund mismatch/);
  await as("service_role", null, null, async () => {
    await pg.query("select public.apply_stripe_invoice($1,30,true)", [invoice]);
    await pg.query("select public.apply_refund('test-refund',$1,150000,true)", [testOrder]);
  });
  await as("authenticated", owner, "aal2", async () => {
    assert.equal((await pg.query("select is_test from public.stripe_invoices where id='in_test_fixture'")).rows[0].is_test, true);
    assert.equal((await pg.query("select status from public.orders where id=$1", [testOrder])).rows[0].status, "refunded");
    assert.deepEqual((await summary()).rows[0].data, before);
  });
  await assert.rejects(as("service_role", null, null, () => pg.query("select public.apply_payment('cross-live',$1,180000,'czk','cs_test_wrong',true)", [paymentOrder])), /Payment mismatch/);
});

test("mode-aware webhook RPCs remain service-only and legacy signatures are removed", async () => {
  for (const signature of ["begin_checkout(uuid)","apply_payment(text,uuid,bigint,text,text)","apply_refund(text,uuid,bigint)","apply_stripe_invoice(jsonb,bigint)"]) {
    assert.equal((await pg.query("select to_regprocedure($1)::text as fn", ["public."+signature])).rows[0].fn, null);
  }
  for (const role of ["anon", "authenticated"]) {
    for (const sql of ["select public.apply_payment('forbidden',null,1,'czk','cs_fixture',true)", "select public.apply_refund('forbidden',null,1,true)", "select public.apply_stripe_invoice('{}',1,true)"]) {
      await assert.rejects(as(role, owner, "aal2", () => pg.query(sql)), /permission denied/);
    }
  }
  await assert.rejects(as("authenticated", outsider, "aal2", () => pg.query("select public.begin_checkout($1,true)", [order])), /Admin \+ MFA required/);
});
