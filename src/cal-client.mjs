import { PRICES, STUDENT_PRICES, currencyLabel } from './pricing.mjs';
const API_ORIGIN = 'https://api.cal.com';
const BACKEND = (import.meta.env?.VITE_SUPABASE_URL || 'https://lsofzsartjesgwetcpzw.supabase.co') + '/functions/v1/admin-api/cal';
const slugPattern = /^[a-z0-9][a-z0-9-]*$/i;
export class BookingError extends Error {
  constructor(message, kind = 'unavailable') { super(message); this.name = 'BookingError'; this.kind = kind; }
}
export function dateKey(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(value));
  const part = type => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function monthDays(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + total) / 7) * 7;
  return Array.from({length:cells}, (_,i) => {
    const date = new Date(Date.UTC(year, month, i - offset + 1));
    return {key:date.toISOString().slice(0,10), day:date.getUTCDate(), current:date.getUTCMonth() === month};
  });
}
function identity(username, eventTypeSlug) {
  if (!slugPattern.test(username || '') || !slugPattern.test(eventTypeSlug || '')) {
    throw new BookingError('Online rezervace pro tuto konzultaci zatím nejsou připravené.', 'unconfigured');
  }
}
export function slotsUrl({username, eventTypeSlug, year, month, timeZone}) {
  identity(username, eventTypeSlug);
  const url = new URL('/v2/slots', API_ORIGIN);
  url.search = new URLSearchParams({
    username, eventTypeSlug, timeZone, format:'range',
    // Include UTC edges so all local dates are covered, including DST changes.
    start: new Date(Date.UTC(year, month, 0)).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 2)).toISOString(),
  }).toString();
  return url.toString();
}
export function parseSlots(payload, {year, month, timeZone, expectedMinutes, now = Date.now()}) {
  if (payload?.status !== 'success' || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new BookingError('Kalendář se nepodařilo načíst. Zkus to znovu nebo mi napiš.');
  /** @type {Record<string, Array<{start: string, end: string | null}>>} */
  const result = {};
  const monthPrefix = `${year}-${String(month + 1).padStart(2,'0')}-`;
  for (const items of Object.values(payload.data)) {
    if (!Array.isArray(items)) throw new BookingError('Kalendář se nepodařilo načíst.');
    for (const item of items) {
      const start = typeof item === 'string' ? item : item?.start;
      const end = typeof item === 'object' ? item?.end : null;
      const startMs = Date.parse(start);
      if (!Number.isFinite(startMs)) throw new BookingError('Kalendář se nepodařilo načíst.');
      if (end && (!Number.isFinite(Date.parse(end)) || Date.parse(end) <= startMs)) throw new BookingError('Kalendář se nepodařilo načíst.');
      if (end && expectedMinutes && (Date.parse(end) - startMs) / 60000 !== expectedMinutes) throw new BookingError('Nastavení této konzultace je potřeba ověřit. Napiš mi prosím pro domluvení termínu.', 'configuration');
      const key = dateKey(startMs, timeZone);
      if (!key.startsWith(monthPrefix) || startMs <= now) continue;
      const iso = new Date(startMs).toISOString();
      result[key] ??= [];
      if (!result[key].some(s => s.start === iso)) result[key].push({start:iso, end:end ? new Date(end).toISOString() : null});
    }
  }
  for (const items of Object.values(result)) items.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  return result;
}
/**
 * @param {{username:string,eventTypeSlug:string,year:number,month:number,timeZone:string,expectedMinutes?:number}} options
 * @param {{fetchImpl?:typeof fetch,signal?:AbortSignal}} [config]
 */
export async function loadSlots(options, {fetchImpl = fetch, signal} = {}) {
  const response = await fetchImpl(`${BACKEND}/slots?${new URL(slotsUrl(options)).searchParams}`, {signal, credentials:'omit'});
  if (!response.ok) throw new BookingError('Volné termíny se nepodařilo načíst. Zkus to znovu nebo mi napiš.');
  return parseSlots(await response.json(), options);
}
export function bookingPayload({username, eventTypeSlug, start, name, email, timeZone, topic, serviceId, language = 'cs', consultationTopic = '', situation = '', horizon = '', financing = ''}) {
  identity(username, eventTypeSlug);
  const milliseconds = Date.parse(start);
  if (!Number.isFinite(milliseconds) || milliseconds <= Date.now()) throw new BookingError('Vyber prosím budoucí termín.', 'validation');
  if (!name?.trim() || name.trim().length > 100 || !email?.trim() || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new BookingError('Vyplň prosím jméno a platný e-mail.', 'validation');
  new Intl.DateTimeFormat('cs-CZ', {timeZone});
  const packageNote = serviceId === 'package' ? `Zvolená nabídka: balíček 3 × 50 minut za ${currencyLabel(PRICES.package)}. Studentská cena balíčku: ${currencyLabel(STUDENT_PRICES.package)}. Tento termín je první konzultace; další dvě včetně jednoho osobního setkání domluvíme samostatně.` : '';
  const topics = {study:'Studium v zahraničí', career:'Práce a kariéra', project:'Vlastní projekt', other:'Jiné téma'};
  const horizons = {soon:'Do 3 měsíců', year:'3 až 12 měsíců', later:'Později'};
  if (!['cs','sk','en'].includes(language)) throw new BookingError('Vyber podporovaný jazyk.', 'validation');
  if (!topics[consultationTopic] || !situation.trim() || situation.trim().length > 2000 || !horizons[horizon]) {
    throw new BookingError('Doplň téma, svou situaci a časový horizont.', 'validation');
  }
  const intake = [
    topics[consultationTopic] ? `Téma: ${topics[consultationTopic]}` : '',
    situation.trim() ? `Situace: ${situation.trim().slice(0,2000)}` : '',
    horizons[horizon] ? `Časový horizont: ${horizons[horizon]}` : '',
    consultationTopic === 'study' && financing.trim() ? `Financování: ${financing.trim().slice(0,500)}` : '',
  ].filter(Boolean).join('\n');
  const notes = [packageNote, intake, topic?.trim().slice(0,1000)].filter(Boolean).join('\n\n');
  return {
    username, eventTypeSlug, start:new Date(milliseconds).toISOString(),
    attendee:{name:name.trim(), email:email.trim(), timeZone, language},
    ...(notes ? {bookingFieldsResponses:{notes}} : {}),
    metadata:{source:'consulting-page', service:serviceId || 'consultation', ...(consultationTopic ? {topic:consultationTopic} : {}), language},
  };
}
export function parseBooking(payload) {
  const booking = payload?.data;
  if (payload?.status !== 'success' || !booking || Array.isArray(booking) || typeof booking.uid !== 'string' || !booking.uid.trim() || !Number.isFinite(Date.parse(booking.start))) throw new BookingError('Potvrzení se nepodařilo ověřit. Zkontroluj prosím e-mail před opakováním rezervace.', 'uncertain');
  const status = String(booking.status || '').toLowerCase();
  if (!['accepted', 'pending'].includes(status)) throw new BookingError('Rezervaci se nepodařilo potvrdit. Zkontroluj prosím e-mail před opakováním.', 'uncertain');
  return {uid:booking.uid, start:new Date(booking.start).toISOString(), status, cancellationToken:payload.cancellationToken || '', meetingUrl:typeof payload.meetingUrl==='string' && /^https:\/\//.test(payload.meetingUrl) ? payload.meetingUrl : '', confirmationEmail:payload.confirmationEmail || 'cal'};
}
export async function createBooking(options, {fetchImpl = fetch} = {}) {
  const body = bookingPayload(options);
  let response;
  try {
    response = await fetchImpl(`${BACKEND}/bookings`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(options), credentials:'omit'});
  } catch {
    throw new BookingError('Potvrzení se nepodařilo načíst. Zkontroluj prosím e-mail před opakováním rezervace.', 'uncertain');
  }
  if (response.status === 409) throw new BookingError('Tento termín už není volný. Vyber prosím jiný.', 'conflict');
  if (!response.ok) {
    const uncertain = response.status >= 500;
    throw new BookingError(uncertain ? 'Potvrzení se nepodařilo načíst. Zkontroluj prosím e-mail před opakováním rezervace.' : 'Rezervaci se nepodařilo dokončit. Ověř zadané údaje nebo mi napiš.', uncertain ? 'uncertain' : 'rejected');
  }
  try {
    const booking = parseBooking(await response.json());
    if (booking.start !== body.start) throw new BookingError('Potvrzení obsahuje jiný termín. Zkontroluj prosím e-mail a napiš mi před opakováním rezervace.', 'uncertain');
    return booking;
  }
  catch (error) { if (error instanceof BookingError) throw error; throw new BookingError('Potvrzení se nepodařilo načíst. Zkontroluj prosím e-mail před opakováním rezervace.', 'uncertain'); }
}

export async function cancelBooking(cancellationToken, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl(`${BACKEND}/cancel`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cancellationToken}), credentials:'omit'});
  if (!response.ok) throw new BookingError('Rezervaci nelze zrušit. Storno je možné nejpozději 24 hodin předem.');
  return response.json();
}
