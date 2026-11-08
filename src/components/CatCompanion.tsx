import { useEffect, useId, useRef, useState } from "react";
import { Cookie, Eye, Hand, Pause, Play } from "lucide-react";
import "./CatCompanion.css";

type CatMood = "wave" | "peek" | "celebrate";
const imageBase = "/demo-assets/mews-cat-";

/** A playful local-only mascot. No rescue record or task is changed here. */
export function CatCompanion({ compact = false }: { compact?: boolean }) {
  const host = useRef<HTMLElement>(null);
  const descriptionId = useId();
  const [mood, setMood] = useState<CatMood>("wave");
  const [treats, setTreats] = useState(0);
  const [replay, setReplay] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true");
  const [message, setMessage] = useState("Your fictional desk buddy is reporting for mew-ty.");

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches || document.documentElement.dataset.reduceMotion === "true");
    const onVisibility = () => setVisible(!document.hidden);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", onVisibility);
    update();
    return () => { observer.disconnect(); preference.removeEventListener("change", update); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  const animate = playing && !reducedMotion && visible && inView;
  function treat() {
    const next = treats + 1;
    setTreats(next); setMood("celebrate"); setReplay(value => value + 1);
    const responses = ["Purr-fect. Employee of the meow-nth!", "A fictional treat for a very real good mood.", "The snack committee approves. Unanimously."];
    setMessage(responses[(next - 1) % responses.length]);
  }
  function peek() {
    const next = mood === "peek" ? "wave" : "peek";
    setMood(next); setReplay(value => value + 1);
    setMessage(next === "peek" ? "Whisker are you? Oh, there you are." : "Hello, human. Looking sharp today!");
  }

  return <aside ref={host} className={`cat-companion${compact ? " cat-companion-compact" : ""}`} aria-label="Playful fictional cat mascot" aria-describedby={descriptionId}>
    <div className="cat-companion-art" aria-hidden="true"><img key={`${mood}-${animate}-${replay}`} src={`${imageBase}${mood}${animate ? ".gif" : "-poster.png"}`} width={112} height={112} alt="" decoding="async"/></div>
    <div className="cat-companion-content"><p className="cat-companion-kicker">A little paws break</p><p className="cat-companion-message" role="status" aria-live="polite">{message}</p>
      <div className="cat-companion-actions">
        <button type="button" onClick={treat}><Cookie size={15} aria-hidden="true"/>Treat the demo cat{treats > 0 && <span className="cat-companion-count" aria-label={`${treats} pretend treats`}>{treats}</span>}</button>
        <button type="button" onClick={peek}>{mood === "peek" ? <Hand size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>}{mood === "peek" ? "Wave hello" : "Play peekaboo"}</button>
        <button type="button" className="cat-companion-motion" aria-label={reducedMotion ? "Cat animations off because reduced motion is enabled" : playing ? "Pause cat animations" : "Play cat animations"} aria-pressed={playing && !reducedMotion} title={reducedMotion ? "Reduced motion is enabled" : playing ? "Pause cat animations" : "Play cat animations"} disabled={reducedMotion} onClick={() => setPlaying(value => !value)}>{playing && !reducedMotion ? <Pause size={15} aria-hidden="true"/> : <Play size={15} aria-hidden="true"/>}<span>{reducedMotion ? "Motion off" : playing ? "Pause" : "Play"}</span></button>
      </div>
      <p id={descriptionId} className="cat-companion-caption">Fictional mascot, pretend treats. Rescue records stay unchanged.{reducedMotion && " Animation paused for reduced motion."}</p>
    </div>
  </aside>;
}
