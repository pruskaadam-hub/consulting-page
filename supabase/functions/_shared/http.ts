import { ApiError } from "./contracts.mjs";
export async function limitedText(req: Request, max: number) {
  if (Number(req.headers.get("content-length") || 0) > max)
    throw new ApiError("Požadavek je příliš velký.", 413);
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > max) {
        await reader.cancel();
        throw new ApiError("Požadavek je příliš velký.", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}
