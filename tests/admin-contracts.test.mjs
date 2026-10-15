import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  eventInput,
  mailInput,
  hmacHex,
  verifyStripe,
  sameSignature,
} from "../supabase/functions/_shared/contracts.mjs";
test("mail requires one recipient and rejects header injection before SMTP", () => {
  const mail = {
    id: crypto.randomUUID(),
    to: "client@example.test",
    subject: "Konzultace",
    text: "Dobrý den.",
  };
  assert.deepEqual(mailInput(mail), mail);
  for (const patch of [
    { to: "a@example.test,b@example.test" },
    { to: "a@example.test\r\nBcc: hidden@example.test" },
    { subject: "Hello\r\nBcc: hidden@example.test" },
    { text: "x".repeat(20001) },
    { id: "bad-id" },
  ])
    assert.throws(() => mailInput({ ...mail, ...patch }));
});
test("telemetry excludes private paths, query strings and freeform personal data", () => {
  const event = {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    name: "consultation_click",
    consent: true,
    path: "/blog/svycarske-cv/",
    language: "cs",
    service: "individual",
    email: "must-not-be-kept@example.test",
  };
  assert.equal("email" in eventInput(event), false);
  for (const patch of [
    { consent: false },
    { path: "/admin/" },
    { path: "/consulting-page/admin/" },
    { path: "/?email=someone" },
    { name: "purchase" },
    { service: "fake" },
    { language: "fake" },
  ])
    assert.throws(() => eventInput({ ...event, ...patch }));
});
test("signed webhook verification checks original bytes and rejects stale or malformed Stripe events", async () => {
  const raw = '{"type":"checkout.session.completed"}',
    secret = "test-secret",
    now = Date.UTC(2026, 9, 15),
    t = Math.floor(now / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${t}.${raw}`)
    .digest("hex");
  assert.equal(
    await verifyStripe(raw, `t=${t},v1=${signature}`, secret, now),
    true,
  );
  assert.equal(
    await verifyStripe(raw + " ", `t=${t},v1=${signature}`, secret, now),
    false,
  );
  assert.equal(
    await verifyStripe(raw, `t=${t},v1=${signature}`, secret, now + 301000),
    false,
  );
  assert.equal(
    await verifyStripe(raw, `t=no,v1=${signature}`, secret, now),
    false,
  );
  assert.equal(
    await hmacHex(secret, raw),
    createHmac("sha256", secret).update(raw).digest("hex"),
  );
  assert.equal(sameSignature("not-a-signature", "not-a-signature"), false);
});
