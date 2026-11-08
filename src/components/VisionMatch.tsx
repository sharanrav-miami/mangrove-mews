import { useCallback, useEffect, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, ScanEye, ShieldCheck } from "lucide-react";
import "./VisionMatch.css";

type ImageOption = { ref: string; label: string; preview: string };
type Evidence = { summary: string; recommendation: string; scores: Record<"coat" | "markings" | "face" | "ears" | "overall", number | null>; agreements: string[]; differences: string[]; limitations: string[] };
type Comparison = { id: string; leftRef: string; rightRef: string; model: string; mode: string; evidence: Evidence; reviewStatus: string; createdAt: string; reviewedAt?: string | null; reviewReason?: string | null };
type Workspace = { available: boolean; fixtures: ImageOption[]; privatePhotos: ImageOption[]; comparisons: Comparison[]; disclaimer: string };
const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("mews_csrf="))?.slice(10) ?? "";
const pretty = (value: string) => value.replaceAll("_", " ");

export function VisionMatch() {
  const [role, setRole] = useState<string | null>(null);
  const [data, setData] = useState<Workspace | null>(null);
  const [leftRef, setLeftRef] = useState("");
  const [rightRef, setRightRef] = useState("");
  const [current, setCurrent] = useState<Comparison | null>(null);
  const [synthetic, setSynthetic] = useState(false);
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Sign in through Care workspace to compare private fictional evidence.");
  const manager = role === "admin" || role === "coordinator";
  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(path, { ...options, credentials: "same-origin" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load photo evidence.");
    return body;
  }, []);
  const refresh = useCallback(async () => {
    try {
      const next = await request("/api/private/vision") as Workspace;
      setData(next);
      const options = [...next.fixtures, ...next.privatePhotos];
      setLeftRef((value) => options.some((item) => item.ref === value) ? value : options[0]?.ref ?? "");
      setRightRef((value) => options.some((item) => item.ref === value) ? value : options[1]?.ref ?? "");
      setCurrent((value) => value ? next.comparisons.find((item) => item.id === value.id) ?? null : null);
      setMessage(next.available ? "Select two different fictional photos. Analysis uses their actual image pixels." : "OpenAI photo analysis is not configured. No scores will be invented.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load image comparison."); }
  }, [request]);
  useEffect(() => { void request("/api/auth/session").then((session) => setRole(session.user?.role ?? null)).catch(() => setRole(null)); }, [request]);
  useEffect(() => { if (manager) void refresh(); }, [manager, refresh]);
  useEffect(() => {
    if (!manager || !data) return;
    try {
      const raw = sessionStorage.getItem("mews-vision-pair");
      if (!raw) return;
      sessionStorage.removeItem("mews-vision-pair");
      const pair: unknown = JSON.parse(raw);
      const permitted = new Set([...data.fixtures, ...data.privatePhotos].map(item => item.ref));
      if (Array.isArray(pair) && pair.length === 2 && pair.every(ref => typeof ref === "string" && permitted.has(ref)) && pair[0] !== pair[1]) {
        setLeftRef(pair[0]); setRightRef(pair[1]); setCurrent(null); setSynthetic(false);
        setMessage("Your fictional demo pair is selected. Review both images and acknowledge before sending to OpenAI.");
      }
    } catch { /* An unavailable handoff never sends images or changes records. */ }
  }, [manager, data]);
  const options = [...(data?.fixtures ?? []), ...(data?.privatePhotos ?? [])];
  const option = (ref: string) => options.find((item) => item.ref === ref);
  const preview = (ref: string) => option(ref)?.preview ?? (/^photo:[0-9a-f-]{36}$/i.test(ref) ? "/api/private/photos/" + ref.slice(6) : "");
  const savedForPair = data?.comparisons.find(item => (item.leftRef === leftRef && item.rightRef === rightRef) || (item.leftRef === rightRef && item.rightRef === leftRef));
  const headers = () => ({ "Content-Type": "application/json", "X-CSRF-Token": csrf() });
  async function compare() {
    if (busy || !synthetic || !leftRef || !rightRef || leftRef === rightRef) return;
    setBusy(true); setCurrent(null); setAck(false); setReason("");
    setMessage("Reading two images and asking the vision agent to compare visible cat features…");
    try {
      const response = await request("/api/private/vision/compare", { method: "POST", headers: headers(), body: JSON.stringify({ synthetic: true, leftRef, rightRef }) });
      await refresh();
      setCurrent(response.comparison ?? null);
      setMessage(response.comparison ? `${response.cached ? "Saved comparison reopened" : "Image analysis saved"} · ${response.mode} mode. A coordinator makes the identity decision.` : response.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image analysis did not complete."); }
    finally { setBusy(false); }
  }
  async function review(decision: "possible_same" | "kept_separate" | "inconclusive") {
    if (!current || busy || !ack || !reason.trim()) return;
    setBusy(true);
    try {
      const response = await request("/api/private/vision/review", { method: "POST", headers: headers(), body: JSON.stringify({ id: current.id, decision, reason: reason.trim(), humanConfirmed: true }) });
      await refresh(); setMessage(response.message); setAck(false); setReason("");
      dispatchEvent(new Event("mews-data-changed"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save the review."); }
    finally { setBusy(false); }
  }
  function chooseSaved(item: Comparison) { setLeftRef(item.leftRef); setRightRef(item.rightRef); setCurrent(item); setAck(false); setReason(""); setMessage("Saved pixel comparison. Human evidence review is recorded separately from any cat merge."); }
  return <section className="vision-match panel" aria-labelledby="vision-title">
    <header className="panel-heading"><div><p className="eyebrow">Actual image inputs · human identity review</p><h2 id="vision-title">Photo vision comparison</h2></div>{manager && <button className="secondary-button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>Refresh</button>}</header>
    <p className="vision-boundary"><ShieldCheck size={18}/>Compare visible markings across two photos. The model cannot confirm identity or merge records.</p>
    {!manager ? <p role="status">{role === "volunteer" ? "A coordinator or admin runs photo analysis. Volunteers can submit fictional photos through Private photo review." : "Sign in as coordinator or admin in Care workspace to open this private evidence desk."} <a href="#overview">Open Care workspace</a></p> : <>
      <div className="vision-inputs">{(["A", "B"] as const).map((label, index) => { const value = index === 0 ? leftRef : rightRef; return <article key={label}><label>Photo {label}<select aria-label={`Photo ${label}`} disabled={busy} value={value} onChange={(event) => { (index === 0 ? setLeftRef : setRightRef)(event.target.value); setCurrent(null); }}>{options.map((item) => <option key={item.ref} value={item.ref}>{item.label}</option>)}</select></label>{preview(value) ? <img src={preview(value)} alt={`Selected fictional cat photograph ${label}`}/> : <div className="vision-placeholder"><Camera size={30}/>Choose an approved image</div>}</article>; })}</div>
      <label className="vision-check"><input type="checkbox" checked={synthetic} onChange={(event) => setSynthetic(event.target.checked)} disabled={busy}/>Both images are fictional demo evidence. Send these selected images to OpenAI for comparison.</label>
      <div className="vision-actions"><button className="primary-button" disabled={busy || !data?.available || !synthetic || !leftRef || !rightRef || leftRef === rightRef} onClick={() => void compare()}><ScanEye size={16}/>{busy ? "Working…" : "Compare actual photos"}</button>{savedForPair && <button className="secondary-button" disabled={busy} onClick={() => chooseSaved(savedForPair)}>Open saved result for this pair</button>}<small>Two images per request · saved results reused · up to 8 new comparisons per hour.</small></div>
      <p className="vision-status" role="status">{message}</p>
      {data && data.comparisons.length > 0 && <section className="vision-history"><h3>Saved comparisons</h3><div>{data.comparisons.map((item) => <button type="button" className={current?.id === item.id ? "secondary-button active" : "secondary-button"} key={item.id} onClick={() => chooseSaved(item)}>{option(item.leftRef)?.label ?? "Photo A"} ↔ {option(item.rightRef)?.label ?? "Photo B"} · {new Date(item.createdAt).toLocaleString()} · {pretty(item.reviewStatus)}</button>)}</div></section>}
      {current && <section className="vision-result" aria-labelledby="vision-result-title"><header><h3 id="vision-result-title">Visible-feature evidence</h3><span className="badge violet">{current.model} · {current.mode}</span></header><div className="vision-result-pair">{[current.leftRef, current.rightRef].map((imageRef, index) => <figure key={imageRef}>{preview(imageRef) && <img src={preview(imageRef)} alt={`Analyzed fictional photo ${index === 0 ? "A" : "B"}`}/>}<figcaption>{index === 0 ? "A" : "B"} · {option(imageRef)?.label ?? "Approved private evidence"}</figcaption></figure>)}</div><p>{current.evidence.summary}</p><p><b>Suggestion:</b> {pretty(current.evidence.recommendation)}</p><div className="vision-scores">{(["coat", "markings", "face", "ears", "overall"] as const).map((category) => <div key={category}><span>{category === "overall" ? "Overall similarity" : category}</span><b>{current.evidence.scores[category] === null ? "Not visible" : Math.round(current.evidence.scores[category]! * 100) + "%"}</b></div>)}</div><p className="vision-score-note">Visual similarity scores are uncalibrated heuristics, not probabilities that two cats are the same.</p><div className="vision-findings">{([['Visible agreements', current.evidence.agreements], ['Differences to review', current.evidence.differences], ['Limitations', current.evidence.limitations]] as [string, string[]][]).map(([title, entries]) => <article key={title}><h4>{title}</h4>{entries.length ? <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>No specific observations returned.</p>}</article>)}</div>
      {current.reviewStatus === "pending_review" ? <div className="vision-review"><h4>Coordinator evidence review</h4><label>Reason for your decision<textarea maxLength={700} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What does the visible evidence support, and what still needs checking?"/></label><label className="vision-check"><input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)}/>I reviewed both photos. This records evidence only; it does not merge cats.</label><div className="vision-actions"><button className="primary-button" disabled={busy || !ack || !reason.trim()} onClick={() => void review("possible_same")}><CheckCircle2 size={15}/>Possible same cat</button><button className="secondary-button" disabled={busy || !ack || !reason.trim()} onClick={() => void review("kept_separate")}>Keep separate</button><button className="secondary-button" disabled={busy || !ack || !reason.trim()} onClick={() => void review("inconclusive")}>Need better photos</button></div></div> : <div className="vision-reviewed"><b>Human review: {pretty(current.reviewStatus)}</b><p>{current.reviewReason}</p><small>{current.reviewedAt ? new Date(current.reviewedAt).toLocaleString() : ""}</small></div>}<p><a href="#matches">Open duplicate record review</a> to inspect source-linked candidates and make any separate merge decision.</p></section>}
      <p className="vision-footer">{data?.disclaimer ?? "Only approved private images and listed fictional cat photos are accepted."} Injury appearance is not a medical diagnosis.</p>
    </>}
  </section>;
}
