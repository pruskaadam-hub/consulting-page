import { ApiError } from "./contracts.mjs";
import { config } from "./auth.ts";
const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const propertyId = () => config("GA4_PROPERTY_ID", false) || "559071834";
export function analyticsConfigured() {
  return /^\d+$/.test(propertyId()) &&
    Boolean(config("GOOGLE_SERVICE_ACCOUNT_JSON", false));
}
export async function reportError(
  response: Response,
  property: string,
  email: string,
) {
  // Inspect only documented codes. Provider messages may contain credentials or
  // unrelated metadata and must never be returned to the browser or logged.
  let reason = "", project = "";
  try {
    const body = await response.json();
    const info = body?.error?.details?.find((item: { "@type"?: string }) =>
      item?.["@type"] === "type.googleapis.com/google.rpc.ErrorInfo"
    );
    reason = typeof info?.reason === "string" ? info.reason : "";
    const match = /^projects\/(\d{1,30})$/.exec(info?.metadata?.consumer || "");
    project = match ? ` Projekt Google Cloud: ${match[1]}.` : "";
  } catch { /* Keep the safe HTTP fallback for non-JSON provider failures. */ }
  const actor =
    /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(email)
      ? ` Služební účet: ${email}.`
      : "";
  if (["SERVICE_DISABLED", "API_DISABLED"].includes(reason)) {
    return new ApiError(
      `Google Analytics Data API není zapnuté v projektu služebního účtu. Povol analyticsdata.googleapis.com v Google Cloud.${project}${actor}`,
      502,
    );
  }
  if (reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
    return new ApiError(
      `Google odmítl rozsah oprávnění pro čtení Analytics. Ověř přístup služebního účtu ke službě GA4 ${property}.${actor}`,
      502,
    );
  }
  if (response.status === 403) {
    return new ApiError(
      `Google odmítl přístup ke službě GA4 ${property} (HTTP 403). Přidej níže uvedenému účtu roli Čtenář / Viewer přímo u této služby a ověř případné přepsání GA4_PROPERTY_ID v Supabase Secrets.${actor}`,
      502,
    );
  }
  if (response.status === 404) {
    return new ApiError(
      `Služba GA4 ${property} nebyla nalezena nebo není tomuto účtu přístupná. Ověř Property ID a roli Čtenář / Viewer.${actor}`,
      502,
    );
  }
  if (response.status === 429) {
    return new ApiError(
      "Google Analytics dočasně omezilo počet požadavků. Zkus přehled načíst později (HTTP 429).",
      502,
    );
  }
  return new ApiError(
    `Google Analytics odmítlo report pro službu ${property} (HTTP ${response.status}). Ověř nastavení Data API a oprávnění služebního účtu.`,
    502,
  );
}
export async function analyticsReport() {
  const property = propertyId();
  if (!/^\d+$/.test(property)) {
    throw new ApiError("Zkontroluj ID služby GA4.", 503);
  }
  const account = JSON.parse(config("GOOGLE_SERVICE_ACCOUNT_JSON"));
  const encoder = new TextEncoder(),
    now = Math.floor(Date.now() / 1000);
  const header = encode(
    encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  );
  const payload = encode(
    encoder.encode(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = encode(
    new Uint8Array(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        encoder.encode(`${header}.${payload}`),
      ),
    ),
  );
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.${signature}`,
    }),
  });
  if (!tokenResponse.ok) {
    throw new ApiError("Google připojení je potřeba zkontrolovat.", 502);
  }
  const token = await tokenResponse.json();
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        metricAggregations: ["TOTAL"],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    },
  );
  if (!response.ok) {
    throw await reportError(response, property, account.client_email);
  }
  const report = await response.json();
  const totals = report.totals?.[0]?.metricValues || [];
  return {
    totals: {
      users: Number(totals[0]?.value || 0),
      sessions: Number(totals[1]?.value || 0),
      views: Number(totals[2]?.value || 0),
    },
    days: (report.rows || []).map(
      (row: {
        dimensionValues: { value: string }[];
        metricValues: { value: string }[];
      }) => ({
        date: row.dimensionValues[0].value,
        users: Number(row.metricValues[0].value),
        sessions: Number(row.metricValues[1].value),
        views: Number(row.metricValues[2].value),
      }),
    ),
  };
}
