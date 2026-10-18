import { useState } from "react";
import { cancelBooking } from "./cal-client.mjs";
import type { Language } from "./locales";
export function Cancellation({ language }: { language: Language }) {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const text = language === "en"
    ? {
      title: "Cancel booking",
      policy:
        "Either of us can cancel up to 24 hours before the meeting starts.",
      done: "Booking cancelled.",
      failed:
        "The booking could not be cancelled. Check the 24-hour deadline or contact me.",
      home: "Back to website",
    }
    : language === "sk"
    ? {
      title: "Zrušiť rezerváciu",
      policy:
        "Rezerváciu môžeš zrušiť ty aj ja najneskôr 24 hodín pred začiatkom stretnutia.",
      done: "Rezervácia zrušená.",
      failed:
        "Rezerváciu sa nepodarilo zrušiť. Over 24-hodinovú lehotu alebo mi napíš.",
      home: "Späť na web",
    }
    : {
      title: "Zrušit rezervaci",
      policy:
        "Rezervaci můžeš zrušit ty i já nejpozději 24 hodin před začátkem schůzky.",
      done: "Rezervace zrušena.",
      failed:
        "Rezervaci se nepodařilo zrušit. Ověř 24hodinovou lhůtu nebo mi napiš.",
      home: "Zpět na web",
    };
  return (
    <main className="section wrap">
      <h1>{text.title}</h1>
      <p>{text.policy}</p>
      {done ? <p role="status">{text.done}</p> : (
        <button
          type="button"
          className="button primary"
          disabled={busy || !location.hash.slice(1)}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await cancelBooking(location.hash.slice(1));
              setDone(true);
            } catch {
              setError(text.failed);
            } finally {
              setBusy(false);
            }
          }}
        >
          {text.title}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        <a href={location.pathname}>{text.home}</a>
      </p>
    </main>
  );
}
