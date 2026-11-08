import { analyzeCommunitySignal, triageReport } from "./triage-agent.js";
import { planStoredCatSearch } from "./search-planner.js";
import { listCareCases, createCareCase, resolveCareCase, getOutcomeReport, outcomeReportCsv } from "./reports.js";
import { listSearchTasks, createSearchTask, updateSearchTask } from "./search-tasks.js";
import { listCommunityReviews, createCommunityReview, updateCommunityReview } from "./community-review.js";
import { getRoutingSettings, setRoutingSettings, listIntakeReview, requestClarification, replyClarification, confirmObservation } from "./confirmations.js";
import { listMissingCases, createMissingCase, decideMissingCase, appendMissingCaseFeedback, saveCaseSearchPlan, getMissingCaseForPlanning } from "./missing-cases.js";
import { allowLoginAttempt, getSession, loginWithPassword, requireRole, requireSameOrigin, revokeCurrentSession, sessionHeaders } from "./auth.js";
import { readPrivatePhoto, reviewPrivatePhoto, uploadPrivatePhoto } from "./photos.js";
import { importSyntheticFixture, validateSyntheticFixtureBatch, normalizeSourceTime } from "./intake.js";
import { parseSyntheticSmsRelay, parseSyntheticWhatsAppExport } from "./raw-intake.js";
import { seedCanonicalCatsFromObservations, materializeCanonicalCensus, applyHumanDedupeDecision, getCanonicalWorkspace } from "./census.js";
import { getVisionWorkspace, compareCatPhotos, reviewVisionComparison } from "./vision-matching.js";
import { listFieldTools, createAppointment, updateAppointment, createSupplyRequest, pledgeSupply, updateSupply, createHandoff, acknowledgeHandoff, closeHandoff } from "./field-tools.js";
import { searchWorkspace, getMyShift } from "./workspace-tools.js";

const service = "mangrove-mews";

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

async function readLimitedJson(request, limit) {
  if (Number(request.headers.get("content-length") || 0) > limit || !request.body) throw new Error("Request too large");
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Error("Request too large"); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function ingestFixture(fixture, env, options = {}) {
  const validated = validateSyntheticFixtureBatch(fixture);
  if (fixture.analysisMode != null && !["rules", "agent"].includes(fixture.analysisMode)) throw new Error("Synthetic intake rejected: invalid analysis mode");
  // Large fixture packs stay quick and predictable. A selected single-message
  // replay can opt into live agents; the result always records its real mode.
  const assessmentEnv = fixture.analysisMode === "rules" || (!fixture.analysisMode && validated.records.length > 12) ? { ...env, OPENAI_API_KEY: undefined } : env;
  // Source identity is claimed before this callback runs. Derived urgency is
  // kept in assessment/observation fields, never written into source flags.
  return importSyntheticFixture({ db: env.DB, fixture: validated, ...options, assessRecord: record => triageReport({ message: record.text, source: record.sourceKind, catCount: record.count?.high, feedingConfirmed: record.feedingConfirmed }, assessmentEnv) });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/auth/login") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      if (!requireSameOrigin(request, env)) return json({ error: "Origin rejected" }, 403);
      if (!(request.headers.get("content-type") ?? "").includes("application/json") || Number(request.headers.get("content-length") || 0) > 2048) return json({ error: "Invalid request" }, 400);
      try {
        const body = await readLimitedJson(request, 2048);
        if (typeof body?.email !== "string" || body.email.length > 254 || typeof body?.password !== "string" || body.password.length > 256) return json({ error: "Invalid credentials" }, 401);
        if (!await allowLoginAttempt(env, request, body.email)) return json({ error: "Sign-in temporarily unavailable" }, 429);
        const session = await loginWithPassword(env, request, body);
        if (!session) return json({ error: "Invalid credentials" }, 401);
        return Response.json({ user: session.user }, { headers: sessionHeaders(session) });
      } catch { return json({ error: "Sign-in unavailable" }, 503); }
    }

    if (pathname === "/api/auth/session") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      const session = await getSession(request, env);
      return session ? json({ user: session.user }) : json({ error: "Authentication required" }, 401);
    }

    if (pathname === "/api/auth/logout") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer", "sponsor"], { csrf: true });
      if (!auth.ok) return auth.response;
      return Response.json({ ok: true }, { headers: await revokeCurrentSession(request, env) });
    }

    if (["/api/private/workspace-search", "/api/private/my-shift"].includes(pathname)) {
      if (request.method !== "GET") return json({error:"Method not allowed"},405);
      const auth=await requireRole(request,env,["admin","coordinator","volunteer"]);
      if(!auth.ok)return auth.response;
      try {
        const common={db:env.DB,session:auth.session};
        const query=new URL(request.url).searchParams;
        return json(pathname.endsWith("my-shift") ? await getMyShift(common) : await searchWorkspace({...common,query:query.get("q")??"",kind:query.get("kind")??"all",area:query.get("area")??""}));
      }catch(error){return json({error:String(error?.message??"Workspace tool unavailable").slice(0,240)},Number(error?.status)||400);}
    }

    if (["/api/private/vision", "/api/private/vision/compare", "/api/private/vision/review"].includes(pathname)) {
      const read=request.method==="GET"&&pathname==="/api/private/vision";
      if(!read&&(request.method!=="POST"||pathname==="/api/private/vision"))return json({error:"Method not allowed"},405);
      const auth=await requireRole(request,env,["admin","coordinator"],{csrf:!read});
      if(!auth.ok)return auth.response;
      try{
        const common={env,session:auth.session};
        if(read)return json(await getVisionWorkspace(common));
        const input=await readLimitedJson(request,5000);
        return json(await (pathname.endsWith("/compare")?compareCatPhotos:reviewVisionComparison)({...common,input}));
      }catch(error){return json({error:String(error?.message??"Image comparison unavailable").slice(0,240)},Number(error?.status)||400);}
    }

    if (pathname==="/api/private/field-tools"||pathname.startsWith("/api/private/field-tools/")) {
      const actions={"/appointments":createAppointment,"/appointments/update":updateAppointment,"/supplies":createSupplyRequest,"/supplies/pledge":pledgeSupply,"/supplies/update":updateSupply,"/handoffs":createHandoff,"/handoffs/acknowledge":acknowledgeHandoff,"/handoffs/close":closeHandoff};
      const suffix=pathname.slice("/api/private/field-tools".length);
      const read=request.method==="GET"&&suffix==="";
      if(!read&&(!actions[suffix]||request.method!=="POST"))return json({error:"Method not allowed"},405);
      const auth=await requireRole(request,env,["admin","coordinator","volunteer"],{csrf:!read});
      if(!auth.ok)return auth.response;
      try{
        const common={db:env.DB,session:auth.session};
        return json(read?await listFieldTools(common):await actions[suffix]({...common,input:await readLimitedJson(request,8000)}));
      }catch(error){return json({error:String(error?.message??"Field coordination unavailable").slice(0,240)},Number(error?.status)||400);}
    }

    if (["/api/private/intake-review", "/api/private/routing-settings", "/api/private/clarifications", "/api/private/clarifications/reply", "/api/private/observations/confirm"].includes(pathname)) {
      const read = request.method === "GET" && ["/api/private/intake-review", "/api/private/routing-settings"].includes(pathname);
      if (!read && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (pathname === "/api/private/intake-review" && !read) return json({ error: "Method not allowed" }, 405);
      const auth = await requireRole(request, env, read || pathname.endsWith("/reply") ? ["admin", "coordinator", "volunteer"] : ["admin", "coordinator"], { csrf: !read });
      if (!auth.ok) return auth.response;
      try {
        const common = { db: env.DB, session: auth.session };
        if (read) return json(pathname.endsWith("routing-settings") ? await getRoutingSettings(common) : await listIntakeReview(common));
        const input = await readLimitedJson(request, 8000);
        const action = pathname.endsWith("routing-settings") ? setRoutingSettings : pathname.endsWith("/reply") ? replyClarification : pathname.endsWith("/confirm") ? confirmObservation : requestClarification;
        const result = await action({ ...common, input });
        await materializeCanonicalCensus(env.DB);
        return json(result);
      } catch (error) { return json({ error: String(error?.message ?? "Intake review unavailable").slice(0, 240) }, Number(error?.status) || 400); }
    }

    if (["/api/private/missing-cases", "/api/private/missing-cases/decision", "/api/private/missing-cases/feedback", "/api/private/missing-cases/plan"].includes(pathname)) {
      const read = request.method === "GET" && pathname === "/api/private/missing-cases";
      if (!read && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const manager = pathname.endsWith("/decision") || pathname.endsWith("/plan");
      const auth = await requireRole(request, env, manager ? ["admin", "coordinator"] : ["admin", "coordinator", "volunteer"], { csrf: !read });
      if (!auth.ok) return auth.response;
      try {
        const common = { db: env.DB, session: auth.session };
        if (read) return json(await listMissingCases(common));
        const input = await readLimitedJson(request, 10000);
        if (pathname.endsWith("/plan")) {
          const record = await getMissingCaseForPlanning({ ...common, id: input.caseId });
          const plan = await planStoredCatSearch({ ...record.case, searchFeedback: record.feedback }, env);
          const stored = { ...plan, appliedFeedbackIds: record.feedback.map((entry) => entry.id), zones: plan.zones.map((zone) => ({ id: zone.id, label: zone.title, position: zone.position, confidence: zone.confidence, priority: Math.round(zone.confidence * 100), radiusM: zone.internalRadiusMeters, safeGuide: zone.detail + " " + zone.feedbackSummary })) };
          await saveCaseSearchPlan({ ...common, input: { caseId: record.case.id, plan: stored } });
          return json({ plan: stored });
        }
        const action = pathname.endsWith("/decision") ? decideMissingCase : pathname.endsWith("/feedback") ? appendMissingCaseFeedback : createMissingCase;
        const result = await action({ ...common, input });
        if (pathname.endsWith("/decision")) await materializeCanonicalCensus(env.DB);
        return json(result, pathname === "/api/private/missing-cases" ? 201 : 200);
      } catch (error) { return json({ error: String(error?.message ?? "Missing-case action unavailable").slice(0, 240) }, Number(error?.status) || 400); }
    }

    if (["/api/private/care-cases", "/api/private/care-cases/resolve", "/api/private/reports/outcomes", "/api/private/reports/outcomes.csv"].includes(pathname)) {
      const reportRoute = pathname.startsWith("/api/private/reports/");
      const mutation = request.method === "POST";
      if ((reportRoute && request.method !== "GET") || (!reportRoute && !["GET", "POST"].includes(request.method)) || (pathname.endsWith("/resolve") && !mutation)) return json({ error: "Method not allowed" }, 405);
      const auth = await requireRole(request, env, mutation ? ["admin", "coordinator"] : reportRoute ? ["admin", "coordinator", "sponsor"] : ["admin", "coordinator", "volunteer"], { csrf: mutation });
      if (!auth.ok) return auth.response;
      try {
        const common = { db: env.DB, session: auth.session };
        if (mutation) {
          const input = await readLimitedJson(request, 6000);
          const result = pathname.endsWith("/resolve") ? await resolveCareCase({ ...common, input }) : await createCareCase({ ...common, input });
          await materializeCanonicalCensus(env.DB);
          return json(result, pathname.endsWith("/resolve") ? 200 : 201);
        }
        const query = new URL(request.url).searchParams;
        const filters = { from: query.get("from"), to: query.get("to") };
        if (!reportRoute) return json(await listCareCases({ ...common, ...filters }));
        const report = await getOutcomeReport({ ...common, ...filters });
        return pathname.endsWith(".csv") ? new Response(outcomeReportCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="synthetic-care-outcomes.csv"', "X-Content-Type-Options": "nosniff" } }) : json(report);
      } catch (error) { return json({ error: String(error?.message ?? "Care report unavailable").slice(0, 240) }, Number(error?.status) || 400); }
    }

    if (["/api/private/search-tasks", "/api/private/search-tasks/update"].includes(pathname)) {
      if (!["GET", "POST"].includes(request.method) || (pathname.endsWith("/update") && request.method !== "POST")) return json({ error: "Method not allowed" }, 405);
      const mutation = request.method === "POST";
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: mutation });
      if (!auth.ok) return auth.response;
      try {
        const common = { db: env.DB, session: auth.session };
        if (!mutation) return json(await listSearchTasks(common));
        const body = await readLimitedJson(request, 8000);
        return json(pathname.endsWith("/update") ? await updateSearchTask({ ...common, body }) : await createSearchTask({ ...common, body }), pathname.endsWith("/update") ? 200 : 201);
      } catch (error) { return json({ error: String(error?.message ?? "Search task unavailable").slice(0, 240) }, Number(error?.status) || 400); }
    }

    if (["/api/private/community-reviews", "/api/private/community-reviews/update"].includes(pathname)) {
      const update = pathname.endsWith("/update");
      if (!["GET", "POST"].includes(request.method) || (update && request.method !== "POST")) return json({ error: "Method not allowed" }, 405);
      const mutation = request.method === "POST";
      const auth = await requireRole(request, env, update ? ["admin", "coordinator"] : ["admin", "coordinator", "volunteer"], { csrf: mutation });
      if (!auth.ok) return auth.response;
      try {
        const common = { db: env.DB, session: auth.session };
        if (!mutation) return json(await listCommunityReviews(common));
        const input = await readLimitedJson(request, 12000);
        return json(update ? await updateCommunityReview({ ...common, input }) : await createCommunityReview({ ...common, input }), update ? 200 : 201);
      } catch (error) { return json({ error: String(error?.message ?? "Community review unavailable").slice(0, 240) }, Number(error?.status) || 400); }
    }

    if (pathname === "/api/private/photos" && request.method === "POST") {
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: true });
      if (!auth.ok) return auth.response;
      return uploadPrivatePhoto(request, env, String(auth.session.userId));
    }

    if (pathname === "/api/private/photos" && request.method === "GET") {
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"]);
      if (!auth.ok) return auth.response;
      const result = await env.DB.prepare("SELECT id, content_type, size_bytes, review_status, created_at, reviewed_at FROM private_photos WHERE (? != 'volunteer' OR uploaded_by = ?) ORDER BY created_at DESC LIMIT 100").bind(auth.session.user.role, String(auth.session.userId)).all();
      return json({ photos: result.results ?? [] });
    }

    if (pathname === "/api/private/synthetic-import") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator"], { csrf: true });
      if (!auth.ok) return auth.response;
      if (!(request.headers.get("content-type") ?? "").includes("application/json") || Number(request.headers.get("content-length") || 0) > 250000) return json({ error: "Invalid fixture" }, 400);
      try {
        const input = await readLimitedJson(request, 250000);
        const result = await ingestFixture(input, env);
        if (result.reportsImported) { await seedCanonicalCatsFromObservations(env.DB); await materializeCanonicalCensus(env.DB); }
        return json({ persisted: result.persisted, batchId: result.batchId, reportsRequested: result.reportsRequested, reportsImported: result.reportsImported, reportsSkipped: result.reportsSkipped, duplicate: result.duplicate, traceIds: result.traceIds, modes: result.modes }, result.reportsImported ? 201 : 200);
      } catch (error) {
        const message = String(error?.message ?? "");
        if (error?.status === 409) return json({ error: message, code: error.code, retryable: error.code === "IMPORT_IN_PROGRESS" }, 409);
        if (message.startsWith("Synthetic intake rejected:")) return json({ error: message }, 400);
        if (/unique constraint/i.test(message)) return json({ error: "This fixture batch is already imported; existing reviews were preserved." }, 409);
        return json({ error: "Import unavailable" }, 503);
      }
    }

    if (pathname === "/api/private/raw-import") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator"], { csrf: true });
      if (!auth.ok) return auth.response;
      try {
        const input = await readLimitedJson(request, 100000);
        if (input?.synthetic !== true || typeof input.text !== "string" || input.text.length > 60000 || !["whatsapp_export", "sms_relay"].includes(input.sourceKind)) return json({ error: "A fictional export and supported source kind are required" }, 400);
        const sourceDigest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.sourceKind + "\n" + input.text.trim())))).map((value) => value.toString(16).padStart(2, "0")).join("");
        const existing = await env.DB.prepare("SELECT id FROM intake_import_batches WHERE source_digest = ?").bind(sourceDigest).first();
        if (existing) return json({ error: "This source was already imported. Stored reviews and census were preserved.", batchId: existing.id }, 409);
        const common = { batchId: input.batchId, provenance: "Deliberately synthetic exported chat fixture; submitted by an authenticated team member." };
        const fixture = input.sourceKind === "whatsapp_export" ? parseSyntheticWhatsAppExport({ ...common, text: input.text }) : parseSyntheticSmsRelay({ ...common, ndjson: input.text });
        const result = await ingestFixture({ ...fixture, analysisMode: input.analysisMode }, env, { sourceDigest });
        if (result.reportsImported) { await seedCanonicalCatsFromObservations(env.DB); await materializeCanonicalCensus(env.DB); }
        return json({ persisted: true, batchId: result.batchId, reportsRequested: result.reportsRequested, reportsImported: result.reportsImported, reportsSkipped: result.reportsSkipped, duplicate: result.duplicate, modes: result.modes, traceIds: result.traceIds }, result.reportsImported ? 201 : 200);
      } catch (error) {
        const message = String(error?.message ?? "");
        if (error?.status === 409) return json({ error: message, code: error.code, retryable: error.code === "IMPORT_IN_PROGRESS" }, 409);
        if (/rejected:|invalid time/i.test(message)) return json({ error: message }, 400);
        if (/unique constraint/i.test(message)) return json({ error: "This source was already imported." }, 409);
        return json({ error: "Raw import unavailable" }, 503);
      }
    }

    if (pathname === "/api/private/field-report") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: true });
      if (!auth.ok) return auth.response;
      try {
        const body = await readLimitedJson(request, 6000);
        const areas = { "Little Havana": "COL-04", "Little River": "COL-02", "North Miami": "COL-07", "Fort Lauderdale": "COL-11", "Miami Beach": "COL-MB-DEMO", "Hialeah": "COL-HL-DEMO", "Homestead": "COL-HM-DEMO", "Hollywood / Broward": null };
        if (body.synthetic !== true || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000 || !Object.hasOwn(areas, body.broadArea) || !["/demo-assets/poppy-calico-limp.png", "/demo-assets/marmalade-orange-tabby.png", "/demo-assets/tux-missing-search.png"].includes(body.photo) || (body.count !== null && (!Number.isInteger(body.count) || body.count < 0 || body.count > 200))) return json({ error: "Use a fictional message, supported demo area and photo, and a valid count." }, 400);
        const batchId = "phone-" + body.id;
        const existing = await env.DB.prepare("SELECT received_at FROM intake_source_messages WHERE batch_id=? AND source_message_id='field' LIMIT 1").bind(batchId).first();
        const observedAt = normalizeSourceTime(body.observedAt === undefined ? existing?.received_at ?? new Date().toISOString() : body.observedAt);
        if (!Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) > Date.now() + 60_000) return json({ error: "Observation time must be a valid past time." }, 400);
        const fixture = parseSyntheticSmsRelay({ batchId, provenance: "Fictional phone submission with deliberately shared demo area and fixture photo.", defaultBroadArea: body.broadArea, ndjson: JSON.stringify({ id: "field", from: "Synthetic team member " + auth.session.userId, received_at: new Date(observedAt).toISOString(), body: "DEMO: " + body.message, attachments: [body.photo] }) });
        const record = fixture.records[0]; record.sourceKind = "phone_report"; record.proposedColonyKey = areas[body.broadArea]; record.broadArea = body.broadArea; record.colonyConfidence = record.proposedColonyKey ? .95 : .4;
        if (body.count !== null) record.count = { low: body.count, high: body.count, confidence: .85 };
        record.feedingConfirmed = body.feedingConfirmed === true;
        if (body.urgent === true) record.flags.push("agent_urgent");
        const result = await ingestFixture(fixture, env);
        if (result.reportsImported) { await seedCanonicalCatsFromObservations(env.DB); await materializeCanonicalCensus(env.DB); }
        return json({ persisted: true, reportsImported: result.reportsImported, reportsSkipped: result.reportsSkipped, duplicate: result.duplicate, traceIds: result.traceIds }, result.reportsImported ? 201 : 200);
      } catch (error) { return json({ error: error?.status === 409 ? String(error.message).slice(0, 240) : /rejected:/i.test(String(error?.message)) ? String(error.message).slice(0, 200) : "Unable to save this field report.", ...(error?.code ? { code: error.code, retryable: error.code === "IMPORT_IN_PROGRESS" } : {}) }, error?.status === 409 ? 409 : 400); }
    }

    if (pathname === "/api/private/census") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer", "sponsor"]);
      if (!auth.ok) return auth.response;
      return json(await getCanonicalWorkspace(env.DB, { publicView: auth.session.user.role === "sponsor" }));
    }

    if (pathname === "/api/public/census") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const workspace = await getCanonicalWorkspace(env.DB, { publicView: true });
      return json({ synthetic: true, colonies: workspace.colonies.map(({ colony_key, broad_area, cat_count, fixed_count, tnr_pending, needs_vet }) => ({ colony_key, broad_area, cat_count, fixed_count, tnr_pending, needs_vet })), cats: [], disclaimer: "Broad fictional activity only. No individual identity, feeder, contacts, source histories, live tags, or precise locations." });
    }

    if (pathname === "/api/private/team") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      const auth = await requireRole(request, env, ["admin", "coordinator"]);
      if (!auth.ok) return auth.response;
      const result = await env.DB.prepare("SELECT id, email, role FROM users WHERE disabled_at IS NULL AND role IN ('admin','coordinator','volunteer') ORDER BY email").all();
      return json({ members: result.results ?? [] });
    }

    if (pathname === "/api/private/dedupe") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator"], { csrf: true });
      if (!auth.ok) return auth.response;
      try {
        const input = await readLimitedJson(request, 3000);
        const result = await applyHumanDedupeDecision(env.DB, { ...input, reviewerId: auth.session.userId });
        await materializeCanonicalCensus(env.DB);
        return json({ ok: true, ...result });
      } catch (error) { return json({ error: String(error?.message ?? "Duplicate review failed").slice(0, 300) }, 409); }
    }

    if (pathname === "/api/private/intake/source-duplicates") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const auth = await requireRole(request, env, ["admin", "coordinator"]);
      if (!auth.ok) return auth.response;
      const result = await env.DB.prepare("SELECT * FROM legacy_fixture_source_duplicates ORDER BY family,source_record_id LIMIT 200").all();
      return json({ synthetic: true, groups: result.results ?? [], note: "Read-only legacy collision inventory. Original source records, reviews, and human decisions were preserved; no automatic deletion or history merge has occurred." });
    }

    if (pathname === "/api/private/intake") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"]);
      if (!auth.ok) return auth.response;
      const reports = await env.DB.prepare("SELECT m.trace_id,m.source_kind,m.volunteer_alias,m.body_redacted,m.broad_area,m.received_at,m.attachment_manifest_json,json_extract(m.raw_fixture_json,'$.flags') AS source_flags_json,o.id AS observation_id,o.proposed_cat_key,o.proposed_colony_key,o.assigned_colony_key,o.assignment_state,o.source_count_low,o.source_count_high,o.source_count_confidence,o.verified_count_low,o.verified_count_high,o.verified_count_confidence,o.colony_confidence,o.duplicate_group,o.urgency,o.uncertainty_note,c.canonical_cat_key,a.mode AS assessment_mode,a.evidence_json AS match_evidence_json FROM intake_source_messages m JOIN intake_observations o ON o.source_message_id=m.id LEFT JOIN canonical_cats c ON c.cat_key=o.proposed_cat_key LEFT JOIN intake_assessments a ON a.observation_id=o.id ORDER BY julianday(m.received_at) DESC LIMIT 200").all();
      const reviews = await env.DB.prepare("SELECT id, review_kind, status, explanation, observation_id FROM intake_review_queue ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,CASE review_kind WHEN 'urgent_care' THEN 0 ELSE 1 END,created_at DESC LIMIT 500").all();
      const feedings = await env.DB.prepare("SELECT o.assigned_colony_key AS colony_key,m.volunteer_alias AS feeder_alias,COALESCE(o.verified_count_high,o.source_count_high) AS headcount,m.received_at AS visited_at,m.trace_id FROM intake_observations o JOIN intake_source_messages m ON m.id=o.source_message_id WHERE o.source_feeding_confirmed=1 AND o.assigned_colony_key IS NOT NULL ORDER BY julianday(m.received_at) DESC LIMIT 200").all();
      return json({ synthetic: true, reports: reports.results ?? [], reviews: reviews.results ?? [], feedings: feedings.results ?? [] });
    }

    if (pathname === "/api/private/reviews/decision") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator"], { csrf: true });
      if (!auth.ok) return auth.response;
      try {
        const body = await readLimitedJson(request, 2048);
        if (typeof body?.id !== "string" || body.id.length > 300 || !["confirmed", "kept_separate", "dismissed"].includes(body.decision)) return json({ error: "Invalid review decision" }, 400);
        const timestamp = new Date().toISOString();
        const decisions = await env.DB.batch([
          env.DB.prepare("INSERT INTO intake_review_decisions (id, review_id, decision, actor_id, decided_at) SELECT ?, id, ?, ?, ? FROM intake_review_queue WHERE id = ? AND status = 'open' AND (review_kind = 'possible_duplicate' OR ? != 'kept_separate')").bind(crypto.randomUUID(), body.decision, auth.session.userId, timestamp, body.id, body.decision),
          env.DB.prepare("UPDATE intake_review_queue SET status = ?, resolved_at = ? WHERE id = ? AND status = 'open' AND (review_kind = 'possible_duplicate' OR ? != 'kept_separate')").bind(body.decision, timestamp, body.id, body.decision),
        ]);
        if (!decisions[0].meta?.changes) return json({ error: "Review not found, already decided, or decision not applicable" }, 409);
        await materializeCanonicalCensus(env.DB);
        return json({ ok: true, decision: body.decision, note: "Decision recorded; no cat records were merged." });
      } catch { return json({ error: "Unable to record decision" }, 400); }
    }

    if (pathname === "/api/private/reports/synthetic.csv") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "sponsor"]);
      if (!auth.ok) return auth.response;
      const query = new URL(request.url).searchParams;
      const start = query.get("start") ?? "";
      const end = query.get("end") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end || !Number.isFinite(Date.parse(`${start}T00:00:00Z`)) || !Number.isFinite(Date.parse(`${end}T00:00:00Z`))) return json({ error: "Use a valid start and end date" }, 400);
      const result = await env.DB.prepare("SELECT m.broad_area, COUNT(*) AS reports, SUM(CASE WHEN o.urgency = 'urgent' THEN 1 ELSE 0 END) AS urgent_reports, SUM(CASE WHEN o.source_feeding_confirmed=1 AND o.assigned_colony_key IS NOT NULL THEN 1 ELSE 0 END) AS feeding_visits FROM intake_source_messages m JOIN intake_observations o ON o.source_message_id = m.id WHERE substr(m.received_at, 1, 10) BETWEEN ? AND ? GROUP BY m.broad_area ORDER BY m.broad_area").bind(start, end).all();
      const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = ["broad_area,reports,urgent_reports,feeding_visits", ...(result.results ?? []).map((row) => [escape(row.broad_area), Number(row.reports), Number(row.urgent_reports), Number(row.feeding_visits)].join(","))];
      return new Response(rows.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="synthetic-community-report.csv"', "X-Content-Type-Options": "nosniff" } });
    }

    if (pathname === "/api/private/feeding-assignments") {
      if (request.method === "GET") {
        const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"]);
        if (!auth.ok) return auth.response;
        const data = await env.DB.prepare("SELECT id, colony_key, assigned_user_id, due_at, status, completed_at FROM feeding_assignments WHERE (? != 'volunteer' OR assigned_user_id = ?) ORDER BY due_at LIMIT 200").bind(auth.session.user.role, auth.session.userId).all();
        return json({ assignments: (data.results ?? []).map((item) => ({ ...item, overdue: item.status === "scheduled" && Date.parse(item.due_at) < Date.now() })) });
      }
      if (request.method === "POST") {
        const auth = await requireRole(request, env, ["admin", "coordinator"], { csrf: true });
        if (!auth.ok) return auth.response;
        try {
          const input = await readLimitedJson(request, 2048);
          if (typeof input?.colonyKey !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(input.colonyKey) || !Number.isInteger(input.assignedUserId) || typeof input.dueAt !== "string" || !Number.isFinite(Date.parse(input.dueAt))) return json({ error: "Invalid assignment" }, 400);
          const volunteer = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role IN ('volunteer', 'coordinator', 'admin') AND disabled_at IS NULL").bind(input.assignedUserId).first();
          if (!volunteer) return json({ error: "Active team member not found" }, 400);
          const id = crypto.randomUUID(); const now = new Date().toISOString();
          await env.DB.batch([
            env.DB.prepare("INSERT INTO feeding_assignments (id, colony_key, assigned_user_id, due_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, input.colonyKey, input.assignedUserId, new Date(input.dueAt).toISOString(), auth.session.userId, now),
            env.DB.prepare("INSERT INTO field_assignment_events (id, assignment_id, actor_id, action, created_at) VALUES (?, ?, ?, 'created', ?)").bind(crypto.randomUUID(), id, auth.session.userId, now),
          ]);
          return json({ id, status: "scheduled" }, 201);
        } catch { return json({ error: "Unable to create assignment" }, 400); }
      }
      return json({ error: "Method not allowed" }, 405);
    }

    if (pathname === "/api/private/feeding-assignments/update") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: true });
      if (!auth.ok) return auth.response;
      try {
        const input = await readLimitedJson(request, 2048);
        if (typeof input?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id) || !["complete", "reassign"].includes(input.action)) return json({ error: "Invalid update" }, 400);
        const existing = await env.DB.prepare("SELECT id, assigned_user_id, status FROM feeding_assignments WHERE id = ?").bind(input.id).first();
        if (!existing || existing.status !== "scheduled") return json({ error: "Assignment is not open" }, 404);
        if (auth.session.user.role === "volunteer" && (input.action !== "complete" || Number(existing.assigned_user_id) !== auth.session.userId)) return json({ error: "Insufficient role" }, 403);
        if (input.action === "reassign") {
          if (!Number.isInteger(input.assignedUserId) || !await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role IN ('admin', 'coordinator', 'volunteer') AND disabled_at IS NULL").bind(input.assignedUserId).first()) return json({ error: "Active team member not found" }, 400);
        }
        const now = new Date().toISOString();
        const update = input.action === "complete" ? env.DB.prepare("UPDATE feeding_assignments SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'scheduled' AND (? != 'volunteer' OR assigned_user_id = ?)").bind(now, input.id, auth.session.user.role, auth.session.userId) : env.DB.prepare("UPDATE feeding_assignments SET assigned_user_id = ? WHERE id = ? AND status = 'scheduled'").bind(input.assignedUserId, input.id);
        const results = await env.DB.batch([update, env.DB.prepare("INSERT INTO field_assignment_events (id, assignment_id, actor_id, action, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), input.id, auth.session.userId, input.action, now)]);
        if (!results[0].meta?.changes) return json({ error: "Assignment already changed" }, 409);
        return json({ ok: true, action: input.action });
      } catch { return json({ error: "Unable to update assignment" }, 400); }
    }

    const photoRoute = pathname.match(/^\/api\/private\/photos\/([0-9a-f-]{36})(?:\/(review))?$/i);
    if (photoRoute) {
      if (request.method === "GET" && !photoRoute[2]) {
        const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"]);
        if (!auth.ok) return auth.response;
        return readPrivatePhoto(env, photoRoute[1], auth.session);
      }
      if (request.method === "POST" && photoRoute[2]) {
        const auth = await requireRole(request, env, ["admin", "coordinator"], { csrf: true });
        if (!auth.ok) return auth.response;
        try { const body = await readLimitedJson(request, 2048); return reviewPrivatePhoto(env, photoRoute[1], body?.decision, String(auth.session.userId)); }
        catch { return json({ error: "Invalid review" }, 400); }
      }
      return json({ error: "Method not allowed" }, 405);
    }

    if (pathname === "/api/config") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      // This browser key must be restricted by HTTP referrer and to Maps JavaScript API.
      return json({ googleMapsBrowserKey: env.GOOGLE_MAPS_BROWSER_KEY ?? null, localDemo: env.LOCAL_DEMO === true });
    }

    if (pathname === "/api/triage") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: true });
      if (!auth.ok) return auth.response;
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return json({ error: "Expected application/json" }, 415);
      try {
        const report = await readLimitedJson(request, 8000);
        if (!report || typeof report !== "object" || typeof report.message !== "string" || report.message.length > 4_000) return json({ error: "Invalid report" }, 400);
        return json(await triageReport(report, env));
      } catch { return json({ error: "Unable to triage this report" }, 400); }
    }

    if (pathname === "/api/lost-cat-search") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: true });
      if (!auth.ok) return auth.response;
      if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "Expected application/json" }, 415);
      try { const input = await readLimitedJson(request, 8000); if (!input || typeof input !== "object" || typeof input.description !== "string" || input.description.length > 2_000) return json({ error: "Invalid lost-cat report" }, 400); return json(await planStoredCatSearch({ ...input, searchFeedback: [] }, env)); }
      catch { return json({ error: "Choose a supported demo area and a valid past last-seen time." }, 400); }
    }

    if (pathname === "/api/community-signal") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
      const auth = await requireRole(request, env, ["admin", "coordinator", "volunteer"], { csrf: true });
      if (!auth.ok) return auth.response;
      if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "Expected application/json" }, 415);
      try {
        const input = await readLimitedJson(request, 16000);
        if (!input || typeof input !== "object" || input.authorized !== true || typeof input.content !== "string" || !input.content.trim() || input.content.length > 6_000) return json({ error: "Authorized, redacted community content is required" }, 400);
        return json(await analyzeCommunitySignal(input, env));
      } catch { return json({ error: "Unable to stage this community signal" }, 400); }
    }

    if (pathname === "/api/health") {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
      }

      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();

        if (result?.ok !== 1) {
          return json({ ok: false, service, database: "unavailable" }, 503);
        }

        return json({ ok: true, service, database: "connected" });
      } catch {
        return json({ ok: false, service, database: "unavailable" }, 503);
      }
    }

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
