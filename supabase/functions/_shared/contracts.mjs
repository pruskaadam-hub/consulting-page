export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function text(value, max, label, required = true) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new ApiError(`Zkontroluj pole ${label}.`);
  return value.trim();
}
export function email(value) {
  const result = text(value, 254, "e-mail");
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(result))
    throw new ApiError("Zadej jednu platnou e-mailovou adresu.");
  return result;
}
export function mailInput(body) {
  if (!UUID.test(body?.id || ""))
    throw new ApiError("Chybí identifikátor zprávy.");
  const subject = text(body.subject, 200, "předmět");
  if (/[\r\n\0]/.test(subject))
    throw new ApiError("Předmět nesmí obsahovat zalomení řádků.");
  const result = {id: body.id, to: email(body.to), subject, text: text(body.text, 20000, "zpráva")};
  for (const field of ["inReplyTo", "references"]) {
    if (body[field] === undefined || body[field] === "") continue;
    if (typeof body[field] !== "string" || body[field].length > 900 || !/^<[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~@-]+>(?: <[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~@-]+>)*$/.test(body[field])) throw new ApiError("Neplatný odkaz na původní zprávu.");
    result[field] = body[field];
  }
  return result;
}
export function eventInput(body) {
  if (
    body?.consent !== true ||
    !UUID.test(body.id || "") ||
    !UUID.test(body.session_id || "")
  )
    throw new ApiError("Měření vyžaduje souhlas.");
  if (
    !["page_view", "consultation_click", "booking_confirmed"].includes(
      body.name,
    ) ||
    !["cs", "sk", "en"].includes(body.language)
  )
    throw new ApiError("Neplatná událost.");
  const path = text(body.path, 250, "cesta");
  if (!/^\/[a-z0-9/_-]*$/i.test(path) || /(?:^|\/)admin(?:\/|$)/.test(path))
    throw new ApiError("Soukromá nebo neplatná cesta.");
  const service = body.service ?? null;
  if (service !== null && !["intro", "individual", "package"].includes(service))
    throw new ApiError("Neplatná služba.");
  const placement = body.placement ?? null;
  if (
    placement !== null &&
    !["hero", "offer", "cta", "calendar"].includes(placement)
  )
    throw new ApiError("Neplatné umístění události.");
  return {
    id: body.id,
    name: body.name,
    session_id: body.session_id,
    path,
    service,
    placement,
    language: body.language,
  };
}
export async function hmacHex(secret, body) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function sameSignature(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    !/^[a-f0-9]{64}$/i.test(a) ||
    !/^[a-f0-9]{64}$/i.test(b)
  )
    return false;
  let diff = 0;
  for (let i = 0; i < 64; i++)
    diff |= a.toLowerCase().charCodeAt(i) ^ b.toLowerCase().charCodeAt(i);
  return diff === 0;
}
export async function verifyStripe(raw, header, secret, now = Date.now()) {
  const parts = (header || "").split(",").map((item) => item.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  if (!t || !/^\d+$/.test(t) || Math.abs(now / 1000 - Number(t)) > 300)
    return false;
  const expected = await hmacHex(secret, `${t}.${raw}`);
  return parts.some(
    ([key, value]) => key === "v1" && sameSignature(value, expected),
  );
}
