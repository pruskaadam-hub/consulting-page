import test from "node:test";
import assert from "node:assert/strict";
import { ensureEventsSecret } from "../scripts/provision-events.mjs";

const projectRef = "lsofzsartjesgwetcpzw", token = "fixture-management-token";
test("event provisioning preserves an existing secret without rotation", async () => {
  let calls = 0;
  const result = await ensureEventsSecret({projectRef,token,fetchImpl: async (url,init) => {
    calls++;
    assert.equal(url, `https://api.supabase.com/v1/projects/${projectRef}/secrets`);
    assert.equal(init.method, undefined);
    return Response.json([{name:"EVENTS_HMAC_SECRET",digest:"fixture-metadata"}]);
  }});
  assert.equal(calls,1);
  assert.deepEqual(result,{created:false});
});
test("event provisioning creates only the missing server secret and does not expose its value", async () => {
  let calls = 0;
  const result = await ensureEventsSecret({projectRef,token,fetchImpl: async (_url,init) => {
    calls++;
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    if(calls===1) return Response.json([{name:"UNRELATED_SECRET"}]);
    assert.equal(calls,2);
    assert.equal(init.method,"POST");
    const body=JSON.parse(init.body);
    assert.equal(body.length,1);
    assert.equal(body[0].name,"EVENTS_HMAC_SECRET");
    assert.match(body[0].value,/^[a-f0-9]{64}$/);
    return Response.json({});
  }});
  assert.deepEqual(result,{created:true});
});
test("event provisioning stops on denial or malformed metadata without overwriting secrets", async () => {
  for(const response of [new Response("private response",{status:403}),Response.json({unexpected:true}),new Response("private response")]){
    let calls=0;
    await assert.rejects(ensureEventsSecret({projectRef,token,fetchImpl: async()=>{calls++;return response;}}),error=>!error.message.includes("private response")&&!error.message.includes(token));
    assert.equal(calls,1);
  }
});
