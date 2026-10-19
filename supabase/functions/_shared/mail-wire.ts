import { ApiError } from "./contracts.mjs";
export interface MailSocket {
  read(buffer: Uint8Array): Promise<number | null>;
  write(buffer: Uint8Array): Promise<number>;
  close(): void;
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export class MailWire {
  private pending = new Uint8Array(0);
  constructor(private socket: MailSocket) {}
  close() {
    try {
      this.socket.close();
    } catch { /* already closed */ }
  }
  private async fill() {
    const buffer = new Uint8Array(16384);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const count = await Promise.race([
        this.socket.read(buffer),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.close();
            reject(
              new ApiError(
                "Poštovní server neodpovídá. Zkus synchronizaci později.",
                504,
              ),
            );
          }, 15000);
        }),
      ]);
      if (!count) {
        throw new ApiError(
          "Poštovní server ukončil spojení. Zkus synchronizaci znovu.",
          502,
        );
      }
      const next = new Uint8Array(this.pending.length + count);
      next.set(this.pending);
      next.set(buffer.subarray(0, count), this.pending.length);
      this.pending = next;
    } finally {
      clearTimeout(timer);
    }
  }
  async line() {
    while (true) {
      for (let i = 1; i < this.pending.length; i++) {
        if (this.pending[i - 1] === 13 && this.pending[i] === 10) {
          const result = decoder.decode(this.pending.subarray(0, i - 1));
          this.pending = this.pending.slice(i + 1);
          return result;
        }
      }
      if (this.pending.length > 65536) {
        throw new ApiError(
          "Poštovní server poslal příliš dlouhou odpověď.",
          502,
        );
      }
      await this.fill();
    }
  }
  async bytes(size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || size > 5_000_000) {
      throw new ApiError(
        "Zpráva je příliš velká. Otevři ji v iCloud Mail.",
        413,
      );
    }
    const result = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      if (!this.pending.length) await this.fill();
      const count = Math.min(size - offset, this.pending.length);
      result.set(this.pending.subarray(0, count), offset);
      offset += count;
      this.pending = this.pending.slice(count);
    }
    return result;
  }
  async write(value: string | Uint8Array) {
    const data = typeof value === "string" ? encoder.encode(value) : value;
    let offset = 0;
    while (offset < data.length) {
      const count = await this.socket.write(data.subarray(offset));
      if (count <= 0) {
        throw new ApiError("Spojení s poštou bylo přerušeno.", 502);
      }
      offset += count;
    }
  }
}
export type MailConnector = (
  hostname: string,
  port: number,
) => Promise<MailWire>;
export const connectMail: MailConnector = async (hostname, port) => {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = Deno.connectTls({ hostname, port }).then((socket) => {
    if (expired) {
      socket.close();
      throw new ApiError("Vypršel čas připojení k poště.", 504);
    }
    return new MailWire(socket);
  });
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new ApiError("Vypršel čas připojení k poště.", 504));
        }, 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
export const mailBase64 = (value: string) =>
  btoa(String.fromCharCode(...encoder.encode(value)));
export function imapQuote(value: string) {
  if (/[\r\n\0]/.test(value)) {
    throw new ApiError("Neplatné nastavení poštovní schránky.", 503);
  }
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
