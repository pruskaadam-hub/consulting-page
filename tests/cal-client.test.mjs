import test from 'node:test';
import assert from 'node:assert/strict';
import {BookingError, dateKey, monthDays, slotsUrl, parseSlots, bookingPayload, parseBooking, createBooking, loadSlots} from '../src/cal-client.mjs';
const identity={username:'adam-pruska',eventTypeSlug:'test-only-event'};
const options={...identity,year:2030,month:5,timeZone:'Europe/Prague',expectedMinutes:30,now:0};
const slot={start:'2030-06-04T08:00:00Z',end:'2030-06-04T08:30:00Z'};
const attendee={...identity,start:slot.start,name:'Test visitor',email:'test@example.invalid',timeZone:'Europe/Prague',serviceId:'intro',consultationTopic:'study',situation:'Preparing an application to ETH.',horizon:'soon'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('Monday-first calendar handles a leap year and month boundaries',()=>{
 const cells=monthDays(2028,1);
 assert.equal(cells.length%7,0);
 assert.equal(cells[0].key,'2028-01-31');
 assert.equal(cells.filter(c=>c.current).length,29);
 assert.equal(cells.find(c=>c.key==='2028-02-29').day,29);
});
test('local date grouping covers midnight and repeated DST hour',()=>{
 assert.equal(dateKey('2026-10-24T22:30:00Z','Europe/Prague'),'2026-10-25');
 assert.equal(dateKey('2026-10-25T00:30:00Z','Europe/Prague'),'2026-10-25');
 assert.equal(dateKey('2026-10-25T01:30:00Z','Europe/Prague'),'2026-10-25');
});
test('public slots request is fixed to Cal.com and uses documented public event identity',()=>{
 const url=new URL(slotsUrl(options));
 assert.equal(url.origin,'https://api.cal.com');
 assert.equal(url.searchParams.get('username'),identity.username);
 assert.equal(url.searchParams.get('eventTypeSlug'),identity.eventTypeSlug);
 assert.equal(url.searchParams.get('timeZone'),'Europe/Prague');
 assert.equal(url.searchParams.get('format'),'range');
 assert.throws(()=>slotsUrl({...options,eventTypeSlug:'https://evil.test/'}),BookingError);
});
test('availability contains only provider slots, removes duplicates and past dates',()=>{
 const result=parseSlots({status:'success',data:{'2030-06-04':[slot,slot,{start:'2020-06-04T08:00:00Z',end:'2020-06-04T08:30:00Z'}]}},{...options,now:Date.parse('2029-01-01')});
 assert.deepEqual(result,{'2030-06-04':[{start:'2030-06-04T08:00:00.000Z',end:'2030-06-04T08:30:00.000Z'}]});
});
test('a service duration mismatch cannot be offered as the requested consultation',()=>{
 assert.throws(()=>parseSlots({status:'success',data:{day:[{...slot,end:'2030-06-04T09:00:00Z'}]}},options),error=>error.kind==='configuration');
 assert.throws(()=>parseSlots({status:'error',data:{}},options),BookingError);
 assert.throws(()=>parseSlots({status:'success',data:{day:'malformed'}},options),BookingError);
});
test('API failures are separate from a valid month with no available times',async()=>{
 assert.deepEqual(await loadSlots(options,{fetchImpl:async()=>response({status:'success',data:{}})}),{});
 await assert.rejects(loadSlots(options,{fetchImpl:async()=>response({status:'error'},403)}),BookingError);
});
test('booking payload uses UTC and omits API keys and irrelevant personal data',()=>{
 const body=bookingPayload({...attendee,start:'2030-06-04T10:00:00+02:00',topic:' My question '});
 assert.equal(body.start,'2030-06-04T08:00:00.000Z');
 assert.match(body.bookingFieldsResponses.notes,/Téma: Studium v zahraničí/);
 assert.match(body.bookingFieldsResponses.notes,/My question/);
 assert.equal(body.attendee.email,'test@example.invalid');
 assert.equal(body.attendee.language,'cs');
 assert.equal('apiKey' in body,false);
 assert.throws(()=>bookingPayload({...attendee,start:'2000-01-01T00:00:00Z'}),BookingError);
 assert.throws(()=>bookingPayload({...attendee,email:'invalid'}),BookingError);
});
test('pending remains pending; malformed or rejected responses never become confirmation',()=>{
 assert.equal(parseBooking({status:'success',data:{uid:'fixture',start:slot.start,status:'pending'}}).status,'pending');
 for(const data of [{},{uid:'',start:slot.start,status:'accepted'},{uid:'fixture',start:slot.start,status:'rejected'}]) {
  assert.throws(()=>parseBooking({status:'success',data}),error=>error.kind==='uncertain');
 }
});
test('successful booking returns provider confirmation, and checks that the booked time matches',async()=>{
 let request;
 const result=await createBooking(attendee,{fetchImpl:async(url,init)=>{request={url,init};return response({status:'success',data:{uid:'fixture',start:slot.start,status:'accepted'}});}});
 assert.equal(result.status,'accepted');
 assert.equal(request.url,'https://lsofzsartjesgwetcpzw.supabase.co/functions/v1/admin-api/cal/bookings');
 assert.equal(request.init.headers['cal-api-version'],undefined);
 assert.equal('Authorization' in request.init.headers,false);
 await assert.rejects(createBooking(attendee,{fetchImpl:async()=>response({status:'success',data:{uid:'fixture',start:'2030-06-04T09:00:00Z',status:'accepted'}})}),error=>error.kind==='uncertain');
});
test('a collision or uncertain network outcome never triggers an automatic booking retry',async()=>{
 let calls=0;
 await assert.rejects(createBooking(attendee,{fetchImpl:async()=>{calls++;return response({},409);}}),error=>error.kind==='conflict');
 assert.equal(calls,1);
 calls=0;
 await assert.rejects(createBooking(attendee,{fetchImpl:async()=>{calls++;throw new TypeError('network');}}),error=>error.kind==='uncertain');
 assert.equal(calls,1);
});


test('intro qualification is required and preserves CTA topic in notes and metadata',()=>{
 for(const invalid of [{consultationTopic:''},{situation:'  '},{horizon:''}]) {
  assert.throws(()=>bookingPayload({...attendee,...invalid}),error=>error.kind==='validation');
 }
 const body=bookingPayload({...attendee,language:'sk',financing:'Swiss scholarship'});
 assert.equal(body.metadata.topic,'study');
 assert.equal(body.attendee.language,'sk');
 assert.match(body.bookingFieldsResponses.notes,/Časový horizont: Do 3 měsíců/);
 assert.match(body.bookingFieldsResponses.notes,/Financování: Swiss scholarship/);
 const career=bookingPayload({...attendee,consultationTopic:'career',financing:'not relevant'});
 assert.doesNotMatch(career.bookingFieldsResponses.notes,/Financování/);
 assert.doesNotMatch(career.bookingFieldsResponses.notes,/not relevant/);
});
test('paid consultation requires qualification and bundle identity survives',()=>{
 const body=bookingPayload({...attendee,serviceId:'package',consultationTopic:'career'});
 assert.match(body.bookingFieldsResponses.notes,/4\s500\sKč/);
 assert.equal(body.metadata.service,'package');
 assert.equal(body.metadata.topic,'career');
});
