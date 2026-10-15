import { ApiError } from "./contracts.mjs";
import { config } from "./auth.ts";
const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export async function analyticsReport() {
  const property = config("GA4_PROPERTY_ID");
  if (!/^\d+$/.test(property))
    throw new ApiError("Zkontroluj ID služby GA4.", 503);
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
  if (!tokenResponse.ok)
    throw new ApiError("Google připojení je potřeba zkontrolovat.", 502);
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
  if (!response.ok)
    throw new ApiError(
      "GA4 nevrátilo přehled. Ověř oprávnění účtu ke službě.",
      502,
    );
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
