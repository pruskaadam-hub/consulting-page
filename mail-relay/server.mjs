import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import {mailInput} from './contracts.mjs';

export function createRelay({secret,username,password,storeDir,transport}) {
  if(!secret || secret.length<32 || !username || !password || !storeDir)throw new Error('Configure MAIL_RELAY_SECRET (32+ characters), ICLOUD_USERNAME, ICLOUD_APP_PASSWORD and RELAY_STORE_DIR.');
  const allowed=createHash('sha256').update(secret).digest();
  const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  return http.createServer(async(req,res)=>{
    if(req.method==='GET' && req.url==='/health')return json(res,200,{ready:true});
    const bearer=req.headers.authorization?.match(/^Bearer (.{1,1024})$/)?.[1]||'';
    if(!timingSafeEqual(allowed,createHash('sha256').update(bearer).digest()))return json(res,401,{error:'Unauthorized'});
    if(req.method==='POST' && req.url==='/verify') {
      try{await transport.verify();return json(res,200,{smtpAuth:true});}
      catch{return json(res,502,{smtpAuth:false});}
    }
    if(req.method!=='POST'||req.url!=='/send')return json(res,404,{error:'Not found'});
    let message;
    try {
      const parts=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>100000){json(res,413,{error:'Request too large',uncertain:false});req.destroy();return;}parts.push(chunk);}
      message=mailInput(JSON.parse(Buffer.concat(parts).toString('utf8')));
    }catch{return json(res,400,{error:'Invalid message',uncertain:false});}
    const file=path.join(storeDir,`${message.id}.json`);
    try {
      await mkdir(storeDir,{recursive:true,mode:0o700});
      const claim=await open(file,'wx',0o600);
      await claim.writeFile(JSON.stringify({status:'sending'}));await claim.close();
    }catch(error) {
      if(error.code==='EEXIST') {
        try{const old=JSON.parse(await readFile(file,'utf8'));if(old.status==='sent')return json(res,200,{status:'sent',messageId:`<${message.id}@adampruska.cz>`});}catch{/* fail closed */}
        return json(res,409,{error:'Message already claimed; verify delivery before sending again',uncertain:true});
      }
      return json(res,503,{error:'Delivery ledger unavailable',uncertain:false});
    }
    try {
      const result=await transport.sendMail({
        from:{name:'Adam Pruška',address:'adam@adampruska.cz'},replyTo:'adam@adampruska.cz',
        to:message.to,subject:message.subject,text:message.text,messageId:`<${message.id}@adampruska.cz>`,
        inReplyTo:message.inReplyTo,references:message.references,
        envelope:{from:'adam@adampruska.cz',to:[message.to]},
        disableFileAccess:true,disableUrlAccess:true,
      });
      if(!result.accepted?.length) {const error=new Error('Rejected');error.responseCode=550;throw error;}
      try{await writeFile(file,JSON.stringify({status:'sent'}),{mode:0o600});}catch{
        // SMTP acceptance remains final even if the receipt cannot be persisted.
      }
      return json(res,200,{status:'sent',messageId:`<${message.id}@adampruska.cz>`});
    }catch(error) {
      const definite=Number(error.responseCode)>=400 || ['CONN','EHLO','AUTH PLAIN','AUTH LOGIN','MAIL FROM','RCPT TO'].includes(error.command);
      const uncertain=!definite;
      try{await writeFile(file,JSON.stringify({status:uncertain?'uncertain':'failed'}),{mode:0o600});}catch{/* the original claim still prevents replay */}
      return json(res,502,{error:uncertain?'SMTP delivery uncertain; check Sent before retrying':'SMTP delivery rejected',uncertain});
    }
  });
}
if(import.meta.url===new URL(process.argv[1],'file:').href) {
  const {MAIL_RELAY_SECRET:secret,ICLOUD_USERNAME:username,ICLOUD_APP_PASSWORD:password,RELAY_STORE_DIR:storeDir,PORT}=process.env;
  const transport=nodemailer.createTransport({host:'smtp.mail.me.com',port:587,secure:false,requireTLS:true,auth:{user:username,pass:password},tls:{servername:'smtp.mail.me.com',minVersion:'TLSv1.2'},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,logger:false,debug:false});
  const server=createRelay({secret,username,password,storeDir,transport});
  server.requestTimeout=45000;server.headersTimeout=15000;
  server.listen(Number(PORT)||8080,'0.0.0.0',()=>console.log('iCloud relay listening; TLS termination required at hosting ingress.'));
}
