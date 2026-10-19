import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRelay} from '../mail-relay/server.mjs';
const secret='fixture-shared-relay-secret-at-least-32-characters';
const message={id:'55555555-5555-4555-8555-555555555555',to:'client@example.test',subject:'Přihláška',text:'Dobrý den, fixture only.'};
async function fixture(run,send=async()=>({accepted:['client@example.test']})) {
  const store=await mkdtemp(path.join(tmpdir(),'mail-relay-test-'));
  let sends=0,verifies=0,last;
  const server=createRelay({secret,username:'fixture@me.com',password:'fixture-app-password',storeDir:store,transport:{verify:async()=>{verifies++;},sendMail:async(value)=>{sends++;last=value;return send(value);}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint=`http://127.0.0.1:${server.address().port}`;
  const request=(body=message,token=secret,target='/send')=>fetch(endpoint+target,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {await run({request,store,endpoint,state:()=>({sends,verifies,last})});}
  finally{await new Promise(resolve=>server.close(resolve));await rm(store,{recursive:true,force:true});}
}
test('SMTP relay authenticates before provider access and does not disclose configuration',()=>fixture(async({request,endpoint,state})=>{
  const health=await (await fetch(endpoint+'/health')).json();assert.deepEqual(health,{ready:true});
  const denied=await request(message,'wrong-key');assert.equal(denied.status,401);assert.equal(state().sends,0);
  const verified=await request({},secret,'/verify');assert.equal(verified.status,200);assert.equal(state().verifies,1);assert.equal(state().sends,0);
}));
test('SMTP relay fixes sender and envelope, persists only status and replays without sending twice',()=>fixture(async({request,store,state})=>{
  const first=await request({...message,from:'spoof@example.test',replyTo:'spoof@example.test'});assert.equal(first.status,200);
  const sent=state().last;assert.equal(sent.from.address,'adam@adampruska.cz');assert.equal(sent.replyTo,'adam@adampruska.cz');assert.deepEqual(sent.envelope,{from:'adam@adampruska.cz',to:[message.to]});assert.equal(sent.disableFileAccess,true);assert.equal(sent.disableUrlAccess,true);
  const replay=await request();assert.equal(replay.status,200);assert.equal(state().sends,1);
  const files=await readdir(store);assert.equal(files.length,1);assert.deepEqual(JSON.parse(await readFile(path.join(store,files[0]),'utf8')),{status:'sent'});
}));
test('concurrent relay requests share an atomic delivery claim',()=>fixture(async({request,state})=>{
  const responses=await Promise.all([request(),request(),request()]);
  assert(responses.every(response=>[200,409].includes(response.status)));assert.equal(state().sends,1);
},async()=>{await new Promise(resolve=>setTimeout(resolve,20));return {accepted:[message.to]};}));
test('header injection and invalid message IDs stop before SMTP',()=>fixture(async({request,state,store})=>{
  for(const patch of [{subject:'Injected\r\nBcc: other@example.test'},{id:'../bad'},{to:'one@example.test,two@example.test'},{inReplyTo:'<x@example.test>\r\nBcc: bad'}]){const result=await request({...message,...patch});assert.equal(result.status,400);}
  assert.equal(state().sends,0);assert.deepEqual(await readdir(store),[]);
}));
test('uncertain SMTP result is sanitized and replay cannot deliver twice',()=>fixture(async({request,state})=>{
  const first=await request();const body=await first.json();assert.equal(first.status,502);assert.equal(body.uncertain,true);assert(!JSON.stringify(body).includes('PRIVATE'));
  const again=await request();assert.equal(again.status,409);assert.equal(state().sends,1);
},async()=>{const error=new Error('PRIVATE password and provider data');error.command='DATA';throw error;}));
test('definite SMTP rejection is distinguished from uncertain delivery',()=>fixture(async({request})=>{
  const result=await request();assert.equal(result.status,502);assert.equal((await result.json()).uncertain,false);
},async()=>{const error=new Error('PRIVATE recipient rejection');error.responseCode=550;error.command='RCPT TO';throw error;}));
