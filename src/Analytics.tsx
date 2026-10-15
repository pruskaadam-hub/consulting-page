import { useEffect, useState } from "react";
import type { Language } from "./locales";
const measurement = import.meta.env.VITE_GA4_MEASUREMENT_ID || "";
const gaEnabled = /^G-[A-Z0-9]+$/.test(measurement);
const eventsEnabled = import.meta.env.VITE_ENABLE_EVENTS === "true";
const project =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lsofzsartjesgwetcpzw.supabase.co";
const consentKey = "ap-analytics-consent",
  sessionKey = "ap-analytics-session";
let initialized = false;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
function consent() {
  try {
    return localStorage.getItem(consentKey);
  } catch {
    return null;
  }
}
function permitted() {
  return navigator.doNotTrack !== "1" && consent() === "accepted";
}
export function trackEvent(
  name: "page_view" | "consultation_click" | "booking_confirmed",
  details: { service?: string; placement?: string; language: Language },
) {
  if (!permitted() || location.pathname.split("/").includes("admin")) return;
  const safePath = location.pathname
    .replace(/[^a-z0-9/_-]/gi, "")
    .slice(0, 250);
  if (gaEnabled && window.gtag)
    window.gtag("event", name, {
      ...details,
      page_location: location.origin + safePath,
      page_title: document.title,
    });
  if (!eventsEnabled) return;
  let sessionId;
  try {
    sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(sessionKey, sessionId);
    }
  } catch {
    return;
  }
  void fetch(`${project}/functions/v1/admin-api/events`, {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      name,
      session_id: sessionId,
      path: safePath,
      ...details,
      consent: true,
    }),
  }).catch(() => {});
}
function activate(language: Language) {
  if (!permitted()) return;
  if (gaEnabled) {
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${measurement}`
    ] = false;
    if (!document.getElementById("ap-ga4")) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", measurement, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      const script = document.createElement("script");
      script.id = "ap-ga4";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurement}`;
      document.head.appendChild(script);
    }
  }
  if (!initialized) {
    initialized = true;
    trackEvent("page_view", { language });
  }
}
function withdraw() {
  initialized = false;
  if (gaEnabled)
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${measurement}`
    ] = true;
  try {
    sessionStorage.removeItem(sessionKey);
  } catch {
    /* No browser storage available. */
  }
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0].trim();
    if (!/^_ga(?:_|$)|^_gid$/.test(name)) continue;
    for (const domain of ["", location.hostname, "." + location.hostname]) {
      document.cookie = `${name}=; Max-Age=0; path=/;${domain ? " domain=" + domain + ";" : ""} SameSite=Lax; Secure`;
    }
  }
}
const copy = {
  cs: {
    title: "Pomůžeš mi zlepšovat web?",
    text: "Se souhlasem měřím návštěvnost a zájem o konzultace pomocí Google Analytics a anonymních událostí. Do měření neposílám údaje z rezervací ani e-maily.",
    eventsOnlyText: "Se souhlasem měřím návštěvnost a zájem o konzultace pomocí anonymních událostí na tomto webu. Do měření neposílám údaje z rezervací ani e-maily.",
    yes: "Povolit měření",
    no: "Bez měření",
    settings: "Nastavení měření",
    withdraw: "Odvolat souhlas",
  },
  sk: {
    title: "Pomôžeš mi zlepšovať web?",
    text: "So súhlasom meriam návštevnosť a záujem o konzultácie pomocou Google Analytics a anonymných udalostí. Do merania neposielam údaje z rezervácií ani e-maily.",
    eventsOnlyText: "So súhlasom meriam návštevnosť a záujem o konzultácie pomocou anonymných udalostí na tomto webe. Do merania neposielam údaje z rezervácií ani e-maily.",
    yes: "Povoliť meranie",
    no: "Bez merania",
    settings: "Nastavenie merania",
    withdraw: "Odvolať súhlas",
  },
  en: {
    title: "Help me improve this website?",
    text: "With your consent, I measure visits and interest in consultations using Google Analytics and anonymous events. Booking details and email addresses are never sent to analytics.",
    eventsOnlyText: "With your consent, I measure visits and interest in consultations using anonymous events on this website. Booking details and email addresses are never sent to analytics.",
    yes: "Allow analytics",
    no: "Without analytics",
    settings: "Analytics preferences",
    withdraw: "Withdraw consent",
  },
};
export function AnalyticsConsent({ language }: { language: Language }) {
  const [open, setOpen] = useState(() => consent() === null),
    [choice, setChoice] = useState(consent());
  const c = copy[language];
  useEffect(() => {
    activate(language);
    const listener = () => {
      setChoice(consent());
      if (permitted()) activate(language);
      else withdraw();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [language]);
  if ((!gaEnabled && !eventsEnabled) || navigator.doNotTrack === "1")
    return null;
  function choose(value: string) {
    try {
      localStorage.setItem(consentKey, value);
    } catch {
      /* Measurement remains off without stored consent. */
    }
    setChoice(value);
    setOpen(false);
    if (value === "accepted") activate(language);
    else withdraw();
  }
  return (
    <>
      <div className="consent-settings wrap">
        <button type="button" onClick={() => setOpen(true)}>
          {c.settings}
        </button>
        {choice === "accepted" && (
          <button type="button" onClick={() => choose("rejected")}>
            {c.withdraw}
          </button>
        )}
      </div>
      {open && (
        <section className="analytics-consent" aria-labelledby="consent-title">
          <h2 id="consent-title">{c.title}</h2>
          <p>{gaEnabled ? c.text : c.eventsOnlyText}</p>
          <div>
            <button type="button" onClick={() => choose("rejected")}>
              {c.no}
            </button>
            <button type="button" onClick={() => choose("accepted")}>
              {c.yes}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
