// Shared pieces for the TV screens: the screen clock (with ?at= previews
// and the ?demo day) and where zone photos come from.
import { useCallback, useEffect, useMemo, useState } from "react";
import { dayKey } from "./club.js";
import { gymLocalIso } from "./gym-time.js";
import { DEMO_END, DEMO_START, demoMoment } from "./demoday.js";

// The public build leaves the gym photos out (they show kids); see
// scripts/publish-app.sh.
export const FLOOR_PHOTOS = import.meta.env.VITE_FLOOR_PHOTOS !== "off";
export const photoUrl = (zone) =>
  zone?.photo && FLOOR_PHOTOS
    ? `${import.meta.env.BASE_URL}floor/${zone.photo}.webp`
    : null;

// "4:05" from milliseconds.
export const countdown = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// ?at=15:40 previews a screen at that time today on the gym clock.
function previewOffset() {
  const at = new URLSearchParams(window.location.search).get("at");
  if (!/^\d{1,2}:\d{2}$/.test(at ?? "")) return 0;
  const [h, m] = at.split(":");
  const when = Date.parse(
    gymLocalIso(dayKey(new Date()), `${h.padStart(2, "0")}:${m}`),
  );
  return Number.isFinite(when) ? when - Date.now() : 0;
}

const search = () => new URLSearchParams(window.location.search);
const TICK_MS = 250;

/*
 * The time a screen shows. Normally the real time (or ?at=15:40), ticking
 * every second. With ?demo it runs the scripted demo day instead, from
 * before opening to after close at ?speed= gym minutes per second
 * (default 4, so the day takes under three minutes), looping; `demo` has
 * the controls.
 */
export function useNow() {
  const offset = useMemo(previewOffset, []);
  const demoOn = useMemo(() => search().has("demo"), []);
  const speed = useMemo(() => {
    const v = Number(search().get("speed"));
    return v > 0 && v <= 60 ? v : 4;
  }, []);
  const day = useMemo(() => dayKey(new Date()), []);
  const [now, setNow] = useState(() => new Date(Date.now() + offset));
  const [minute, setMinute] = useState(DEMO_START);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (demoOn) return;
    const id = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(id);
  }, [offset, demoOn]);
  useEffect(() => {
    if (!demoOn || !playing) return;
    const id = setInterval(
      () =>
        setMinute((m) => {
          const next = m + (speed * TICK_MS) / 1000;
          return next > DEMO_END ? DEMO_START : next;
        }),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [demoOn, playing, speed]);
  const seek = useCallback(
    (m) => setMinute(Math.min(DEMO_END, Math.max(DEMO_START, m))),
    [],
  );
  if (!demoOn) return { now, preview: offset !== 0, demo: null };
  // Whole minutes, so the demo state is rebuilt once per gym minute.
  const whole = Math.floor(minute);
  return {
    now: demoMoment(day, whole),
    preview: false,
    demo: {
      day,
      minute: whole,
      playing,
      toggle: () => setPlaying((p) => !p),
      seek,
    },
  };
}
