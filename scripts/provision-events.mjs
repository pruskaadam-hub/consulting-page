import { randomBytes } from "node:crypto";

// Called only by the backend deployment. Never return or log the generated value.
export async function ensureEventsSecret({
  projectRef,
  token,
  fetchImpl = fetch,
}) {
  if (!/^[a-z]{20}$/.test(projectRef) || !token)
    throw new Error("Supabase project and deployment credentials are required.");
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/secrets`;
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetchImpl(endpoint, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Cannot inspect Supabase secret names (HTTP ${response.status}).`);
  }
  let entries;
  try { entries = await response.json(); }
  catch { throw new Error("Unexpected Supabase secret metadata response."); }
  if (!Array.isArray(entries) || entries.some(item => typeof item?.name !== "string"))
    throw new Error("Unexpected Supabase secret metadata response.");
  if (entries.some(item => item.name === "EVENTS_HMAC_SECRET"))
    return { created: false };
  const saved = await fetchImpl(endpoint, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify([{
      name: "EVENTS_HMAC_SECRET",
      value: randomBytes(32).toString("hex"),
    }]),
    signal: AbortSignal.timeout(15000),
  });
  if (!saved.ok) {
    await saved.body?.cancel();
    throw new Error(`Cannot configure first-party events (HTTP ${saved.status}).`);
  }
  await saved.body?.cancel();
  return { created: true };
}
