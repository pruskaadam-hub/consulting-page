// Read-only integration check for the deployment environment.
// No booking is created, no credentials are used, no attendee data is sent.
import { appendFile } from 'node:fs/promises';
import { loadSlots } from '../src/cal-client.mjs';
import { SITE_URL } from '../src/site-config.mjs';
const origin=new URL(SITE_URL).origin;
const username=process.env.VITE_CAL_USERNAME;
const types=[['intro',process.env.VITE_CAL_INTRO_SLUG,30],['individual',process.env.VITE_CAL_INDIVIDUAL_SLUG,50],['package',process.env.VITE_CAL_PACKAGE_SLUG,50]];
const now=new Date();
const results=[];
const fetchWithOrigin=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(20000),headers:{...init.headers,Origin:origin}}).then(async response=>{
 if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(`Cal.com availability returned HTTP ${response.status}: ${typeof detail.error==='string' ? detail.error : 'no diagnostic'}`);}
 const allowed=response.headers.get('access-control-allow-origin');
 if(allowed!=='*' && allowed!==origin)throw new Error('Cal.com does not allow browser access from the production origin. A server-side integration is required.');
 return response;
});
async function verify(){
for(const [name,slug,minutes] of types){
 if(!username || !slug)throw new Error(`Missing public Cal.com mapping: ${name}`);
 const slots=await loadSlots({username,eventTypeSlug:slug,year:now.getUTCFullYear(),month:now.getUTCMonth(),timeZone:'Europe/Prague',expectedMinutes:minutes},{fetchImpl:fetchWithOrigin});
 const count=Object.values(slots).reduce((sum,items)=>sum+items.length,0);
 results.push(`- ${name}: public event found, duration checked where slots exist, ${count} available starts this month.`);
 console.log(`Cal.com ${name}: public availability verified (${count} starts).`);
}
for(const [path,method,headers] of [['slots','GET','content-type'],['bookings','POST','content-type']]){
 const response=await fetch(`${process.env.VITE_SUPABASE_URL || 'https://lsofzsartjesgwetcpzw.supabase.co'}/functions/v1/admin-api/cal/${path}`,{method:'OPTIONS',signal:AbortSignal.timeout(20000),headers:{Origin:origin,'Access-Control-Request-Method':method,'Access-Control-Request-Headers':headers}});
 if(!response.ok)throw new Error(`Cal.com ${path} preflight failed with HTTP ${response.status}`);
 const allowed=response.headers.get('access-control-allow-origin');
 const methods=(response.headers.get('access-control-allow-methods')||'').toUpperCase();
 const allowedHeaders=(response.headers.get('access-control-allow-headers')||'').toLowerCase();
 if(allowed!=='*' && allowed!==origin)throw new Error(`Cal.com ${path} origin is not allowed.`);
 if(!methods.split(',').map(x=>x.trim()).includes(method))throw new Error(`Cal.com ${path} method is not allowed.`);
 for(const header of headers.split(','))if(allowedHeaders!=='*' && !allowedHeaders.split(',').map(x=>x.trim()).includes(header))throw new Error(`Cal.com ${path} header is not allowed: ${header}`);
 console.log(`Cal.com ${path}: browser preflight verified.`);
}
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### Public Cal.com integration\n${results.join('\n')}\n- Browser GET and POST preflight verified.\n- No real booking was submitted.\n`);

}
try {
 await verify();
} catch (error) {
 const message=String(error?.message || "Unknown Cal.com integration error").replaceAll("%","%25").replaceAll("\r","%0D").replaceAll("\n","%0A");
 console.error(`::error title=Public Cal.com integration::${message}`);
 process.exitCode=1;
}
