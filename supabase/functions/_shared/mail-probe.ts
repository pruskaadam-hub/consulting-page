// Deployment-only network check: fixed destinations, no authentication or message data.
export async function probeMailTransport() {
  async function probe(hostname: string, port: number) {
    let conn: Deno.TlsConn | undefined;
    let expired = false;
    const timer = setTimeout(() => { expired = true; try { conn?.close(); } catch {} }, 6000);
    try {
      conn = await Deno.connectTls({hostname,port});
      if (expired) { conn.close(); return false; }
      const buffer = new Uint8Array(512);
      const count = await conn.read(buffer);
      const greeting = new TextDecoder().decode(buffer.subarray(0,count || 0));
      return port === 993 ? greeting.startsWith('* OK') : greeting.startsWith('220');
    } catch { return false; }
    finally { clearTimeout(timer); try {conn?.close();} catch {} }
  }
  const [imap,smtp] = await Promise.all([probe('imap.mail.me.com',993),probe('smtp.mail.me.com',465)]);
  return {imapTls:imap,smtpTls465:smtp};
}
