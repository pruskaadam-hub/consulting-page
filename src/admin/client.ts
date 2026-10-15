import { createClient } from "@supabase/supabase-js";
export const projectUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lsofzsartjesgwetcpzw.supabase.co";
// Public browser key. Authorization still requires Auth, MFA and database RLS.
// Environment configuration can override it when changing Supabase projects.
const publicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_yye0yQ6BO85LYPA-8McyIA_jdghM6E5";
function validPublicKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(
        atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
      ).role === "anon"
    );
  } catch {
    return false;
  }
}
export const configured = Boolean(
  globalThis.isSecureContext &&
    /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(projectUrl) &&
    validPublicKey(publicKey),
);
export const db = configured
  ? createClient(projectUrl, publicKey, {
      auth: {
        storage: sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
export async function api(path: string, body?: unknown) {
  if (!db) throw new Error("Připojení administrace zatím není aktivní.");
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) throw new Error("Přihlas se znovu.");
  const response = await fetch(`${projectUrl}/functions/v1/admin-api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publicKey,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Backend nevrátil platnou odpověď.");
  }
  if (!response.ok) throw new Error(result.error || "Operace se nezdařila.");
  return result;
}
export function priceMinor(value: string) {
  if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(value))
    throw new Error("Zadej platnou částku v Kč.");
  const [whole, decimal = ""] = value.replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (amount <= 0 || amount > 100_000_000)
    throw new Error("Zadej částku od 0,01 do 1 000 000 Kč.");
  return amount;
}
export const money = (minor: number) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 2,
  }).format(minor / 100);
