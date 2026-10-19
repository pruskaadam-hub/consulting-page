import { connectMail } from "./mail-wire.ts";
import { NativeImap } from "./mail-imap.ts";
import { verifySmtpLogin } from "./mail-smtp.ts";
// Only the service-role endpoint can invoke this. No messages are sent or returned.
export async function probeMailTransport() {
  async function probe(hostname:string,port:number) {
    let wire;
    try {wire=await connectMail(hostname,port);const line=await wire.line();return port===993 ? line.startsWith('* OK') : line.startsWith('220');}
    catch {return false;}finally{wire?.close();}
  }
  const [imap,smtp]=await Promise.all([probe('imap.mail.me.com',993),probe('smtp.mail.me.com',465)]);
  const username=Deno.env.get('ICLOUD_USERNAME')?.trim(),password=Deno.env.get('ICLOUD_APP_PASSWORD')?.trim();
  let inbox=false,sent=false,smtpAuth=false,imapLogin=false;
  if(username && password && imap) {
    let client;
    try {client=await NativeImap.open(username,password);imapLogin=true;await client.select('inbox');inbox=true;await client.select('sent');sent=true;}
    catch {/* statuses only, no provider or mailbox data */}finally{client?.close();}
  }
  if(username && password && smtp)try{smtpAuth=await verifySmtpLogin(username,password);}catch{/* statuses only */}
  return {imapTls:imap,smtpTls465:smtp,imapLogin,inbox,sent,smtpAuth};
}
