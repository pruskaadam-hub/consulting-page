import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { content, type Service } from './content';
import { copies, type Language, type Topic } from './locales';
import { formatPrice } from './localized-content';
import { BookingError, createBooking, dateKey, loadSlots, monthDays } from './cal-client.mjs';

type Slot = {start: string; end: string | null};
type Confirmation = {uid: string; start: string; status: string};
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
const zones = [...new Set([localZone, 'Europe/Prague', 'Europe/Zurich', 'Europe/London', 'America/New_York', 'UTC'])];
type Props = {service:Service; language:Language; intentTopic:Topic; onTopicChange:(topic:Topic)=>void; onSubmittingChange:(busy:boolean)=>void};

export function Calendar({service, language, intentTopic, onTopicChange, onSubmittingChange}:Props) {
  const t=copies[language].calendar;
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
  const [notes, setNotes] = useState('');
  const [situation, setSituation] = useState('');
  const [horizon, setHorizon] = useState('');
  const [financing, setFinancing] = useState('');
  const disabled=submitting || uncertain;
  const today = dateKey(Date.now(), timeZone);
  const todayParts = today.split('-').map(Number);
  const currentIndex = todayParts[0]*12 + todayParts[1]-1;
  const index = month.year*12+month.month;
  const days = useMemo(()=>monthDays(month.year,month.month),[month.year,month.month]);
  const monthLabel = new Intl.DateTimeFormat(copies[language].locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(month.year,month.month,15)));
  const displayDate = (start: string) => new Intl.DateTimeFormat(copies[language].locale,{timeZone,day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(start));
  const displayTime = (start: string) => new Intl.DateTimeFormat(copies[language].locale,{timeZone,hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(start));

  useEffect(()=>{
    const controller = new AbortController();
    setSlots({});setDay('');setSlot(null);setError('');setUncertain(false);
    if (!service.calSlug) {setLoading(false);setError(t.errorUnconfigured);return ()=>controller.abort();}
    setLoading(true);
    loadSlots({username:content.calUsername,eventTypeSlug:service.calSlug,year:month.year,month:month.month,timeZone,expectedMinutes:service.minutes},{signal:controller.signal})
      .then(result=>{if(!controller.signal.aborted)setSlots(result);})
      .catch((e: unknown)=>{if(!controller.signal.aborted)setError(e instanceof BookingError && e.kind==='configuration' ? t.errorConfiguration : t.errorLoad);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[service.calSlug,service.minutes,month.year,month.month,timeZone,refresh,t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!slot || submitting || uncertain || submissionInFlight.current)return;
    submissionInFlight.current = true;
    onSubmittingChange(true);
    setSubmitting(true);setSubmitError('');
    try {
      const result = await createBooking({username:content.calUsername,eventTypeSlug:service.calSlug,start:slot.start,name,email,timeZone,topic:notes,serviceId:service.id,language,consultationTopic:intentTopic,situation,horizon,financing});
      setConfirmation(result);
    } catch(e) {
      const kind=e instanceof BookingError ? e.kind : 'uncertain';
      setSubmitError(({conflict:t.errorConflict,validation:t.errorValidation,rejected:t.errorRejected} as Record<string,string>)[kind] || t.errorUncertain);
      if (!(e instanceof BookingError) || kind==='uncertain')setUncertain(true);
      if(kind==='conflict') {setSlot(null);setRefresh(value=>value+1);}
    } finally {submissionInFlight.current = false;setSubmitting(false);onSubmittingChange(false);}
  }

  if(confirmation)return <div className="calendar-confirmation" role="status">
    <span className="confirmation-check" aria-hidden="true">✓</span>
    <h3>{confirmation.status==='accepted' ? t.acceptedTitle : t.pendingTitle}</h3>
    <p>{confirmation.status==='accepted' ? t.accepted : t.pending}</p>
    <p>{service.title}<br /><strong>{displayDate(confirmation.start)}</strong><br />{t.timezone}: {timeZone}</p>
    <p>{confirmation.status==='accepted' ? t.acceptedText : t.pendingText}</p>
    {service.id==='package' && <p>{t.packageConfirmed}</p>}
  </div>;

  return <div className="native-calendar" aria-busy={loading || submitting}>
    <div className="calendar-heading"><div><h3>{service.title}</h3><p>{service.id==='package' ? t.firstPackage : t.online.replace('{minutes}',String(service.minutes))} <span>·</span> {formatPrice(service.price,language)}</p></div><span className="calendar-initials" aria-hidden="true">ap.</span></div>
    <div className="calendar-controls"><h4 id="month-title">{monthLabel}</h4><div><button type="button" aria-label={t.previous} disabled={index<=currentIndex || disabled} onClick={()=>{const d=new Date(Date.UTC(month.year,month.month-1,1));setMonth({year:d.getUTCFullYear(),month:d.getUTCMonth()});}}>←</button><button type="button" aria-label={t.next} disabled={index>=currentIndex+6 || disabled} onClick={()=>{const d=new Date(Date.UTC(month.year,month.month+1,1));setMonth({year:d.getUTCFullYear(),month:d.getUTCMonth()});}}>→</button></div></div>
    <div className="calendar-weekdays" aria-hidden="true">{t.weekdays.map(d=><span key={d}>{d}</span>)}</div>
    <div className="calendar-days" role="group" aria-labelledby="month-title">{days.map(cell=>{
      const available=cell.current && cell.key>=today && Boolean(slots[cell.key]?.length);
      return <button type="button" key={cell.key} className={`${cell.current ? '' : 'outside'} ${cell.key===day ? 'selected' : ''}`} disabled={!available || loading || disabled} aria-pressed={cell.key===day} aria-label={`${new Intl.DateTimeFormat(copies[language].locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(cell.key+'T12:00:00Z'))}, ${available ? t.available : t.unavailable}`} onClick={()=>{setDay(cell.key);setSlot(null);setSubmitError('');}}>{cell.day}{available && <span className="available-dot" />}</button>;
    })}</div>
    <label className="timezone-label">{t.timezone}<select value={timeZone} disabled={disabled} onChange={event=>setTimeZone(event.target.value)}>{zones.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</select></label>
    <div className="calendar-status" aria-live="polite">
      {loading && <p>{t.loading}</p>}
      {error && <><p>{error}</p>{service.calSlug && <button className="text-link" type="button" onClick={()=>setRefresh(v=>v+1)}>{t.retry}</button>}<a className="text-link" href={`mailto:${content.email}?subject=${encodeURIComponent(service.title+': '+t.emailSubject)}`}>{t.email} ↗</a></>}
      {!loading && !error && Object.keys(slots).length===0 && <p>{t.noSlots}</p>}
      {!loading && !error && Object.keys(slots).length>0 && !day && <p>{t.selectDay}</p>}
    </div>
    {submitError && <p className="booking-error" role="alert">{submitError}</p>}
    {day && <div className="slot-picker" role="group" aria-label={t.times}>{slots[day]?.map(item=><button type="button" key={item.start} disabled={disabled} aria-pressed={slot?.start===item.start} className={slot?.start===item.start ? 'selected' : ''} onClick={()=>{setSlot(item);setSubmitError('');}}>{displayTime(item.start)}</button>)}</div>}
    {slot && <form className="booking-form" onSubmit={submit}>
      <p className="booking-summary"><strong>{displayDate(slot.start)}</strong><span>{service.title} · {formatPrice(service.price,language)}</span></p>
      <label>{t.name}<input type="text" autoComplete="name" name="name" required maxLength={100} value={name} disabled={disabled} onChange={e=>setName(e.target.value)} /></label>
      <label>{t.emailLabel}<input autoComplete="email" name="email" type="email" required maxLength={254} value={email} disabled={disabled} onChange={e=>setEmail(e.target.value)} /></label>
      {service.id==='intro' && <p className="qualification-note">{t.qualification}</p>}
      <label>{t.topic}<select name="consultationTopic" value={intentTopic} required={service.id==='intro'} disabled={disabled} onChange={e=>onTopicChange(e.target.value as Topic)}><option value="">{t.selectTopic}</option><option value="study">{t.topicStudy}</option><option value="career">{t.topicCareer}</option><option value="project">{t.topicProject}</option><option value="other">{t.topicOther}</option></select></label>
      {service.id==='intro' && <>
        <label>{t.situation}<textarea name="situation" rows={3} required maxLength={2000} value={situation} disabled={disabled} onChange={e=>setSituation(e.target.value)} /></label>
        <label>{t.horizon}<select name="horizon" required value={horizon} disabled={disabled} onChange={e=>setHorizon(e.target.value)}><option value="">{t.selectHorizon}</option><option value="soon">{t.soon}</option><option value="year">{t.year}</option><option value="later">{t.later}</option></select></label>
        {intentTopic==='study' && <label>{t.financing} <span className="muted">{t.optional}</span><input type="text" name="financing" maxLength={500} value={financing} disabled={disabled} onChange={e=>setFinancing(e.target.value)} /></label>}
      </>}
      {service.id!=='intro' && <label>{t.notes} <span className="muted">{t.optional}</span><textarea name="notes" rows={3} maxLength={1000} value={notes} disabled={disabled} onChange={e=>setNotes(e.target.value)} /></label>}
      <p className="privacy-note">{t.privacy} <a href="https://cal.com/privacy" target="_blank" rel="noopener noreferrer">{t.privacyLink}</a></p>
      <button type="submit" className="button primary" disabled={disabled}>{submitting ? t.submitting : service.id==='package' ? t.bookPackage : t.confirm} <span aria-hidden="true">↗</span></button>
    </form>}
    <p className="calendar-provider">{t.provider}</p>
  </div>;
}
