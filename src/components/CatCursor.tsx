import { useEffect, useRef, useState } from "react";
import { MousePointer2, PawPrint } from "lucide-react";
import "./CatCursor.css";

const NATIVE_TARGETS = "input,textarea,select,[contenteditable]:not([contenteditable='false']),[data-native-cursor],.google-map,.gm-style,.map-fallback,.field-map,[draggable='true']";

/** Optional decorative cursor. The pointer's click target always stays native. */
export function CatCursor({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const cursor = useRef<HTMLDivElement>(null);
  const position = useRef({ x: -100, y: -100 });
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [artworkReady, setArtworkReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true");
  const [celebrating, setCelebrating] = useState(false);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setFinePointer(pointer.matches); setReducedMotion(motion.matches || document.documentElement.dataset.reduceMotion === "true"); };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    pointer.addEventListener("change", update); motion.addEventListener("change", update); update();
    return () => { observer.disconnect(); pointer.removeEventListener("change", update); motion.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    let frame: number | null = null;
    function show(value: boolean) {
      if (activeRef.current !== value) { activeRef.current = value; setActive(value); }
      if (cursor.current) cursor.current.style.visibility = value ? "visible" : "hidden";
      if (value) document.documentElement.dataset.catCursorActive = "true";
      else delete document.documentElement.dataset.catCursorActive;
    }
    const hide = () => show(false);
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Tab") hide(); };
    function move(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!enabled || !finePointer || !artworkReady || event.pointerType === "touch" || document.hidden || target?.closest(NATIVE_TARGETS)) { hide(); return; }
      position.current = { x: event.clientX, y: event.clientY };
      show(true);
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const { x, y } = position.current;
        if (!cursor.current) return;
        cursor.current.style.transform = `translate3d(${x}px,${y}px,0)`;
        cursor.current.style.setProperty("--cat-offset-x", x + 60 > innerWidth ? "-54px" : "7px");
        cursor.current.style.setProperty("--cat-offset-y", y + 60 > innerHeight ? "-54px" : "7px");
      });
    }
    function press(event: PointerEvent) {
      if (!activeRef.current || event.button !== 0 || reducedMotion) return;
      setCelebrating(true);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      celebrationTimer.current = setTimeout(() => setCelebrating(false), 1800);
    }
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", press, { passive: true });
    document.addEventListener("pointerleave", hide);
    document.addEventListener("keydown", keyboard);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    if (!enabled || !finePointer || !artworkReady) hide();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      hide();
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerdown", press);
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("pointerleave", hide); document.removeEventListener("visibilitychange", hide); window.removeEventListener("blur", hide);
    };
  }, [enabled, finePointer, artworkReady, reducedMotion]);
  useEffect(() => () => { if (celebrationTimer.current) clearTimeout(celebrationTimer.current); }, []);
  const mood = celebrating ? "celebrate" : "wave";
  const animated = active && !reducedMotion;
  return <>
    <div ref={cursor} className="mews-cat-cursor" aria-hidden="true"><span className="mews-cat-cursor-hotspot"/><img src={`/demo-assets/mews-cat-${mood}${animated ? ".gif" : "-poster.png"}`} width={46} height={46} alt="" onLoad={() => setArtworkReady(true)} onError={() => setArtworkReady(false)}/></div>
    {finePointer && <button type="button" className="mews-cat-cursor-toggle" data-native-cursor="true" onClick={onToggle} aria-label={enabled ? "Use normal cursor" : "Use cat cursor"} aria-pressed={enabled} title={reducedMotion && enabled ? "Cat cursor uses a still image for reduced motion" : undefined}>{enabled ? <MousePointer2 size={15} aria-hidden="true"/> : <PawPrint size={15} aria-hidden="true"/>}{enabled ? "Use normal cursor" : "Use cat cursor"}</button>}
  </>;
}
