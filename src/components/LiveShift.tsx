import { useEffect, useRef, useState } from "react";
import { Check, MapPin, Pause, Play } from "lucide-react";
import { DemoDataDownloads } from "./DemoDataDownloads";
type Source = { schemaVersion: number; batchId: string; sourceKind: string; provenance: string; records: { id: string; text: string; volunteerAlias: string; broadArea: string; receivedAt: string; attachments?: { fixturePath: string }[] }[] };
type Scenario = "original" | "followup" | "weekend";
type Delivered = Source["records"][number] & { result: string; scenario: Scenario };
const scenarios: Record<Scenario, { label: string; path: string; description: string }> = {
  original: { label: "Original 12-report demo", path: "/demo-data/synthetic-intake-batch.json", description: "Core intake, duplicate review, urgent care, and feeder visit examples." },
  followup: { label: "Expanded 28-report morning", path: "/demo-data/synthetic-followup-shift.json", description: "Multilingual follow-up across eight South Florida demo areas." },
  weekend: { label: "Weekend dispatch · 72 reports / 18 colonies", path: "/demo-data/synthetic-weekend-shift.json", description: "Four connected rounds in English, Spanish, Portuguese, and Haitian Creole. Includes 31 new named cats, two duplicate candidates, migration, urgent care, and feeder handoffs. All invented." },
};
export function LiveShift() {
  const [delivered, setDelivered] = useState<Delivered[]>([]);
  const [playing, setPlaying] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("original");
  const [assessmentMode, setAssessmentMode] = useState<"rules" | "agent">("rules");
  const [delayMs, setDelayMs] = useState(1500);
  const [notice, setNotice] = useState("Sign in as an admin or coordinator, then start a fictional shift. Every delivered message is stored by the backend.");
  const indexes = useRef<Record<Scenario, number>>({ original: 0, followup: 0, weekend: 0 });
  const deliveryCounts = useRef<Record<Scenario, { imported: number; skipped: number }>>({ original: { imported: 0, skipped: 0 }, followup: { imported: 0, skipped: 0 }, weekend: { imported: 0, skipped: 0 } });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  async function play() {
    if (playing) { controller.current?.abort(); setPlaying(false); return; }
    const abort = new AbortController(); controller.current = abort; setPlaying(true);
    try {
      const selected = scenarios[scenario];
      const response = await fetch(selected.path, { signal: abort.signal });
      if (!response.ok) throw new Error("Fixture unavailable");
      const fixture = await response.json() as Source;
      while (indexes.current[scenario] < fixture.records.length && !abort.signal.aborted) {
        const record = fixture.records[indexes.current[scenario]];
        const csrf = document.cookie.split("; ").find((value) => value.startsWith("mews_csrf="))?.slice(10) ?? "";
        // The fixture's stable batch ID plus record ID makes replay idempotent in D1.
        const incoming = await fetch("/api/private/synthetic-import", { method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ ...fixture, synthetic: true, analysisMode: assessmentMode, batchId: `${fixture.batchId}-${record.id}`, records: [record] }) });
        if (!incoming.headers.get("content-type")?.includes("application/json")) throw new Error("Backend unavailable");
        const result = await incoming.json();
        // Only an accepted identity is delivered. A conflicting payload or an
        // in-flight claim is a real error, never a harmless duplicate advance.
        if (!incoming.ok) throw new Error(result.error ?? "Import failed");
        const imported = Number(result.reportsImported ?? 1);
        const skipped = Number(result.reportsSkipped ?? 0);
        deliveryCounts.current[scenario].imported += imported;
        deliveryCounts.current[scenario].skipped += skipped;
        setDelivered((current) => [...current, { ...record, scenario, result: skipped ? "Already stored · original evidence and reviews retained" : "Stored · triage " + (result.modes ?? ["unknown"]).join(", ") }]);
        indexes.current[scenario] += 1;
        dispatchEvent(new Event("mews-data-changed"));
        setNotice(indexes.current[scenario] + " of " + fixture.records.length + " fictional sources checked · " + deliveryCounts.current[scenario].imported + " newly stored · " + deliveryCounts.current[scenario].skipped + " already stored. No source is counted twice across bulk and chat replay.");
        await new Promise<void>((resolve) => { const timer = setTimeout(resolve, delayMs); abort.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
      }
      if (!abort.signal.aborted) setNotice("Shift checked · " + deliveryCounts.current[scenario].imported + " newly stored · " + deliveryCounts.current[scenario].skipped + " already stored. Open Care workspace to review the census and urgent cases; original evidence and human decisions were retained.");
    } catch (error) { if (!abort.signal.aborted) setNotice(error instanceof Error ? error.message : "Delivery stopped."); }
    finally { if (controller.current === abort) setPlaying(false); }
  }
  return <><DemoDataDownloads/><section className="panel live-shift"><div className="panel-heading"><div><p className="eyebrow">Fictional field chat · backend delivery</p><h2>Live synthetic shift</h2></div><button className="primary-button" onClick={() => void play()}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause" : "Start / resume"}</button></div><label className="field-label">Demo scenario<select value={scenario} disabled={playing} onChange={(event) => setScenario(event.target.value as Scenario)}>{(Object.entries(scenarios) as [Scenario, typeof scenarios[Scenario]][]).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><div className="shared-actions"><label className="field-label">Triage mode<select value={assessmentMode} disabled={playing} onChange={(event) => setAssessmentMode(event.target.value as "rules" | "agent")}><option value="rules">Fast rules · no model call</option><option value="agent">Live agent · requires server key</option></select></label><label className="field-label">Replay pace<select value={delayMs} disabled={playing} onChange={(event) => setDelayMs(Number(event.target.value))}><option value={1500}>Presentation · 1.5 seconds</option><option value={200}>Accelerated · 0.2 seconds</option></select></label></div><p className="helper-copy">{scenarios[scenario].description} Changing scenarios only changes this replay panel; it never clears stored reports. Existing records keep their first assessment mode when replayed.</p><p role="status">{notice}</p><div className="live-chat-stream" aria-live="polite">{delivered.map((item, index) => <article key={`${item.scenario}-${item.id}-${index}`}><header><b>{item.volunteerAlias}</b><small>{new Date(item.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></header><p>{item.text}</p>{item.attachments?.filter((attachment) => /^\/demo-assets\/[a-z0-9-]+\.png$/i.test(attachment.fixturePath)).map((attachment) => <img key={attachment.fixturePath} src={attachment.fixturePath} alt="Fictional cat photo from incoming message"/>)}<small><MapPin size={13}/> {item.broadArea} · approximate demo area</small><em><Check size={13}/>{item.result}</em></article>)}</div></section></>;
}
