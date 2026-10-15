import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { ApiError } from "./contracts.mjs";
export function config(name: string, required = true) {
  const value = Deno.env.get(name) || "";
  if (required && !value)
    throw new ApiError("Služba ještě není propojená.", 503);
  return value;
}
export const serviceClient = () =>
  createClient(config("SUPABASE_URL"), config("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export async function requireAdmin(req: Request) {
  const token = req.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiError("Přihlas se do administrace.", 401);
  const client = createClient(
    config("SUPABASE_URL"),
    config("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError("Přihlášení vypršelo.", 401);
  const permission = await client.rpc("is_admin");
  if (permission.error || permission.data !== true)
    throw new ApiError("Vyžaduje se účet správce a dvoufázové ověření.", 403);
  return { client, user: data.user };
}
