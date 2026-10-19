// Run only with the owner's Supabase management token supplied through secure settings.
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ensureEventsSecret } from "./provision-events.mjs";
const ref = process.env.SUPABASE_PROJECT_REF || "lsofzsartjesgwetcpzw";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Add it to GitHub Actions Secrets or secure Codex environment settings, never to source code or chat.",
  );
  process.exit(1);
}
if (!/^[a-z]{20}$/.test(ref)) throw new Error("Invalid project ref");
async function query(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Supabase database operation failed (HTTP ${response.status}); no credentials or response body logged.`,
    );
  return response.json();
}
const existing = await query(
  "select to_regclass('public.admin_backend_versions')::text as marker",
);
if (!Array.isArray(existing))
  throw new Error("Unexpected management API response");
if (!existing[0]?.marker) {
  const conflicts = await query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('admin_users','clients','orders','bookings','invoices','stripe_invoices','business_settings','tasks','mail_outbox','events','event_rate_limits','webhook_events','invoice_counters')",
  );
  if (conflicts.length)
    throw new Error(
      "Existing table names overlap with this migration. Review the project before applying changes.",
    );
  const sql = await readFile(
    new URL("../supabase/migrations/202610150001_admin.sql", import.meta.url),
    "utf8",
  );
  await query(`begin;\n${sql}\ncommit;`);
  console.log("Admin schema created with row-level security.");
} else {
  const version = await query(
    "select version from public.admin_backend_versions where version='202610150001'",
  );
  if (!version.length)
    throw new Error("Unknown backend version. Migration review required.");
  console.log("Admin schema version already installed.");
}
for (const [version, filename] of [
  ["202610150002", "202610150002_stripe_modes.sql"],
  ["202610150003", "202610150003_invoice_due_dates.sql"],
  ["202610150004", "202610150004_service_invoices.sql"],
  ["202610150005", "202610150005_invoice_identity.sql"],
  ["202610190001", "202610190001_mail_client.sql"],
]) {
  const applied = await query(
    `select version from public.admin_backend_versions where version='${version}'`,
  );
  if (applied.length) {
    console.log(`Backend migration ${version} already installed.`);
    continue;
  }
  const sql = await readFile(
    new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8",
  );
  await query(`begin;\n${sql}\ncommit;`);
  console.log(`Backend migration ${version} installed.`);
}
const appointment = await readFile(
  new URL("../supabase/appoint-owner.sql", import.meta.url),
  "utf8",
);
const owners = await query(appointment);
console.log(
  owners.length === 1
    ? "Owner account appointed."
    : "Create the owner in Supabase Authentication, then run the appointment again.",
);
const events = await ensureEventsSecret({ projectRef: ref, token });
console.log(events.created
  ? "First-party events secret configured."
  : "First-party events secret already configured; preserved.");
const deployment = spawnSync(
  "npx",
  [
    "--yes",
    "supabase@2.121.0",
    "functions",
    "deploy",
    "admin-api",
    "--project-ref",
    ref,
    "--no-verify-jwt",
    "--use-api",
  ],
  { stdio: "inherit", env: { ...process.env, NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || path.resolve('../.cache/npm') } },
);
if (deployment.status !== 0) process.exit(deployment.status ?? 1);
console.log(
  "Backend deployed. Configure Auth, allowed origins and provider secrets according to docs/admin-setup.md.",
);

let mailProbeStage = "keys";
// Verify fixed iCloud TLS transports from the actual Edge runtime. No mailbox login or email send.
try {
  const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),
  });
  if (!keysResponse.ok) {mailProbeStage=`keys-http-${keysResponse.status}`;throw new Error("Key lookup unavailable");}
  const keys = await keysResponse.json();
  const service = keys.find(item => item.name === "service_role")?.api_key;
  if (!service) {mailProbeStage="service-key-missing";throw new Error("Server credential unavailable");}
  mailProbeStage="invoke";
  const response = await fetch(`https://${ref}.supabase.co/functions/v1/admin-api/mail/verify-transport`, {
    method:"POST",headers:{Authorization:`Bearer ${service}`},signal:AbortSignal.timeout(60000),
  });
  if (!response.ok) {mailProbeStage=`invoke-http-${response.status}`;throw new Error("Probe unavailable");}
  const result = await response.json();
  console.log(`::notice title=iCloud TLS transports::IMAP993=${result.imapTls === true}; SMTP465=${result.smtpTls465 === true}; IMAP_LOGIN=${result.imapLogin === true}; INBOX=${result.inbox === true}; SENT=${result.sent === true}; SMTP_AUTH=${result.smtpAuth === true}`);
} catch {
  console.log(`::warning title=iCloud TLS transports::Runtime transport verification unavailable (${mailProbeStage}); no messages sent.`);
}
