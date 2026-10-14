import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { content, priceLabel, type Service } from './content';
import { BookingError, createBooking, dateKey, loadSlots, monthDays } from './cal-client.mjs';

type Slot = {start: string; end: string | null};
type Confirmation = {uid: string; start: string; status: string};
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
const zones = [...new Set([localZone, 'Europe/Prague', 'Europe/Zurich', 'Europe/London', 'America/New_York', 'UTC'])];

export function Calendar({service, onSubmittingChange}: {service: Service; onSubmittingChange: (busy: boolean) => void}) {
  const [timeZone, setTimeZone] = useState(localZone);
  const initial = dateKey(Date.now(), timeZone).split('-').map(Number);
  const [month, setMonth] = useState({year:initial[0], month:initial[1]-1});
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const [submitError, setSubmitError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const today = dateKey(Date.now(), timeZone);
  const todayParts = today.split('-').map(Number);
  const currentIndex = todayParts[0]*12 + todayParts[1]-1;
  const index = month.year*12+month.month;
  const days = useMemo(()=>monthDays(month.year,month.month),[month.year,month.month]);
  const monthLabel = new Intl.DateTimeFormat('cs-CZ',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(month.year,month.month,15)));
  const displayDate = (start: string) => new Intl.DateTimeFormat('cs-CZ',{timeZone,day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(start));
  const displayTime = (start: string) => new Intl.DateTimeFormat('cs-CZ',{timeZone,hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(start));

  useEffect(()=>{
    const controller = new AbortController();
    setSlots({});setDay('');setSlot(null);setError('');setUncertain(false);
    if (!service.calSlug) {setLoading(false);setError('Online rezervaci pro tento typ konzultace připravujeme. Termín si zatím můžeme domluvit e-mailem.');return ()=>controller.abort();}
    setLoading(true);
    loadSlots({username:content.calUsername,eventTypeSlug:service.calSlug,year:month.year,month:month.month,timeZone,expectedMinutes:service.minutes},{signal:controller.signal})
      .then(result=>{if(!controller.signal.aborted)setSlots(result);})
      .catch((e: unknown)=>{if(!controller.signal.aborted)setError(e instanceof BookingError ? e.message : 'Kalendář se nepodařilo načíst. Zkus to znovu nebo mi napiš.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[service.calSlug,service.minutes,month.year,month.month,timeZone,refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!slot || submitting || uncertain || submissionInFlight.current)return;
    submissionInFlight.current = true;
    onSubmittingChange(true);
    setSubmitting(true);setSubmitError('');
    try {
      const result = await createBooking({username:content.calUsername,eventTypeSlug:service.calSlug,start:slot.start,name,email,timeZone,topic,serviceId:service.id});
      setConfirmation(result);
    } catch(e) {
      const message = e instanceof BookingError ? e.message : 'Potvrzení se nepodařilo ověřit. Zkontroluj prosím e-mail před opakováním rezervace.';
      setSubmitError(message);
      if (!(e instanceof BookingError) || e.kind === 'uncertain')setUncertain(true);
      if(e instanceof BookingError && e.kind==='conflict') {setSlot(null);setRefresh(value=>value+1);}
    } finally {submissionInFlight.current = false;setSubmitting(false);onSubmittingChange(false);}
  }

  if(confirmation)return <div className="calendar-confirmation" role="status">
    <span className="confirmation-check" aria-hidden="true">✓</span>
    <p className="eyebrow">{confirmation.status==='accepted' ? 'Rezervace potvrzena' : 'Žádost o termín přijata'}</p>
    <h3>{confirmation.status==='accepted' ? 'Máme domluveno.' : 'Ozvu se s potvrzením.'}</h3>
    <p>{service.title}<br /><strong>{displayDate(confirmation.start)}</strong><br />Časové pásmo: {timeZone}</p>
    <p>{confirmation.status==='accepted' ? 'Podrobnosti o schůzce najdeš v potvrzovacím e-mailu.' : 'Termín čeká na potvrzení. Sleduj prosím svůj e-mail.'}</p>
    {service.id==='package' && <p>Teď máš vybraný termín prvního setkání. Další dvě konzultace domluvíme společně.</p>}
  </div>;

  return <div className="native-calendar" aria-busy={loading || submitting}>
    <div className="calendar-heading"><div><span className="eyebrow">Vybraný formát</span><h3>{service.title}</h3><p>{service.id==='package' ? 'První setkání · 50 min' : `${service.minutes} minut online`} <span>·</span> {priceLabel(service.price)}</p></div><span className="calendar-initials" aria-hidden="true">ap.</span></div>
    <div className="calendar-controls"><h4 id="month-title">{monthLabel}</h4><div><button type="button" aria-label="Předchozí měsíc" disabled={index<=currentIndex || submitting || uncertain} onClick={()=>{const d=new Date(Date.UTC(month.year,month.month-1,1));setMonth({year:d.getUTCFullYear(),month:d.getUTCMonth()});}}>←</button><button type="button" aria-label="Další měsíc" disabled={index>=currentIndex+6 || submitting || uncertain} onClick={()=>{const d=new Date(Date.UTC(month.year,month.month+1,1));setMonth({year:d.getUTCFullYear(),month:d.getUTCMonth()});}}>→</button></div></div>
    <div className="calendar-weekdays" aria-hidden="true">{['Po','Út','St','Čt','Pá','So','Ne'].map(d=><span key={d}>{d}</span>)}</div>
    <div className="calendar-days" role="group" aria-labelledby="month-title">{days.map(cell=>{
      const available=cell.current && cell.key>=today && Boolean(slots[cell.key]?.length);
      return <button type="button" key={cell.key} className={`${cell.current ? '' : 'outside'} ${cell.key===day ? 'selected' : ''}`} disabled={!available || loading || submitting || uncertain} aria-pressed={cell.key===day} aria-label={`${new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(cell.key+'T12:00:00Z'))}${available ? ', dostupné termíny' : ', nelze vybrat'}`} onClick={()=>{setDay(cell.key);setSlot(null);setSubmitError('');}}>{cell.day}{available && <span className="available-dot" />}</button>;
    })}</div>
    <label className="timezone-label">Časové pásmo<select value={timeZone} disabled={submitting || uncertain} onChange={event=>setTimeZone(event.target.value)}>{zones.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</select></label>
    <div className="calendar-status" aria-live="polite">
      {loading && <p>Načítám skutečné volné termíny…</p>}
      {error && <><p>{error}</p>{service.calSlug && <button className="text-link" type="button" onClick={()=>setRefresh(v=>v+1)}>Zkusit znovu</button>}<a className="text-link" href={`mailto:${content.email}?subject=${encodeURIComponent(service.title+' — domluvení termínu')}`}>Domluvit termín e-mailem ↗</a></>}
      {!loading && !error && Object.keys(slots).length===0 && <p>V tomto měsíci nejsou volné termíny. Zkus další měsíc nebo mi napiš.</p>}
      {!loading && !error && Object.keys(slots).length>0 && !day && <p>Vyber zvýrazněný den a pak čas, který ti vyhovuje.</p>}
    </div>
    {submitError && <p className="booking-error" role="alert">{submitError}</p>}
    {day && <div className="slot-picker" role="group" aria-label="Volné časy">{slots[day]?.map(item=><button type="button" key={item.start} disabled={submitting || uncertain} aria-pressed={slot?.start===item.start} className={slot?.start===item.start ? 'selected' : ''} onClick={()=>{setSlot(item);setSubmitError('');}}>{displayTime(item.start)}</button>)}</div>}
    {slot && <form className="booking-form" onSubmit={submit}>
      <p className="booking-summary"><strong>{displayDate(slot.start)}</strong><span>{service.title} · {priceLabel(service.price)}</span></p>
      <label>Jméno<input autoComplete="name" name="name" required maxLength={100} value={name} disabled={submitting || uncertain} onChange={e=>setName(e.target.value)} /></label>
      <label>E-mail<input autoComplete="email" name="email" type="email" required maxLength={254} value={email} disabled={submitting || uncertain} onChange={e=>setEmail(e.target.value)} /></label>
      <label>Co chceš probrat? <span className="muted">(nepovinné)</span><textarea name="topic" rows={3} maxLength={1000} value={topic} disabled={submitting || uncertain} onChange={e=>setTopic(e.target.value)} /></label>
      <p className="privacy-note">Údaje předáme Cal.com pro rezervaci a potvrzení schůzky. <a href="https://cal.com/privacy" target="_blank" rel="noopener noreferrer">Ochrana osobních údajů</a></p>
      <button type="submit" className="button primary" disabled={submitting || uncertain}>{submitting ? 'Odesílám rezervaci…' : service.id==='package' ? 'Rezervovat první konzultaci' : 'Potvrdit rezervaci'} <span aria-hidden="true">↗</span></button>
    </form>}
    <p className="calendar-provider">Dostupnost a rezervace spravuje Cal.com.</p>
  </div>;
}
