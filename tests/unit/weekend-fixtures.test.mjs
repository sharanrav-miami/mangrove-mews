import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { prepareSyntheticImport, validateSyntheticFixtureBatch } from "../../worker/intake.js";
import { parseSyntheticSmsRelay, parseSyntheticWhatsAppExport } from "../../worker/raw-intake.js";
import { WEEKEND_CAT_DETAILS, WEEKEND_CAT_META, WEEKEND_COLONIES } from "../../worker/synthetic-cat-catalog.js";

const fixtureUrl = new URL("../../public/demo-data/synthetic-weekend-shift.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const areas = ["Little Havana", "Little River", "North Miami", "Fort Lauderdale", "Miami Beach", "Hialeah", "Homestead", "Hollywood / Broward"];

test("weekend dispatch retains 72 traceable multilingual reports across 18 fictional colonies", async () => {
  const batch = validateSyntheticFixtureBatch(fixture);
  const prepared = prepareSyntheticImport(batch, { now: "2026-11-08T14:00:00.000Z" });
  assert.equal(prepared.messages.length, 72);
  assert.equal(new Set(batch.records.map(record => record.id)).size, 72);
  assert.equal(new Set(batch.records.map(record => record.proposedColonyKey)).size, 18);
  assert.equal(WEEKEND_COLONIES.length, 18);
  assert.deepEqual(new Set(WEEKEND_COLONIES.map(colony => colony.key)), new Set(fixture.colonyCatalog.map(colony => colony.colonyKey)));
  assert.ok(WEEKEND_COLONIES.every(colony => areas.includes(colony.area) && colony.name));
  assert.equal(new Set(batch.records.map(record => record.proposedCatKey)).size, 38);
  assert.deepEqual(new Set(prepared.summary.broadAreasCovered), new Set(areas));
  assert.equal(batch.records.filter(record => record.sourceKind === "whatsapp_export").length, 36);
  assert.equal(batch.records.filter(record => record.sourceKind === "sms_relay").length, 36);
  assert.equal(new Set(prepared.messages.map(message => message.traceId)).size, 72);
  assert.ok(prepared.messages.every(message => message.traceId === `${fixture.batchId}:${message.id}`));
  for (const flag of ["injury", "pregnancy", "illness", "feeder_gap", "kittens"]) {
    assert.ok(prepared.messages.some(message => message.flags.includes(flag) && message.urgency === "urgent"), flag);
  }
  const uncertain = prepared.messages.find(message => message.id === "wa-w021");
  assert.deepEqual(uncertain.count, { low: 0, high: 2, confidence: .45 });
  assert.equal(uncertain.assignedColonyKey, null);
  assert.equal(uncertain.assignmentState, "unmatched");
  assert.ok(uncertain.review.some(review => review.kind === "uncertain_count"));
  assert.ok(prepared.messages.some(message => message.text.includes("Mwen konte")));
  assert.ok(prepared.messages.some(message => message.text.includes("Vi 4 adultos")));
  assert.ok(prepared.messages.some(message => message.text.includes("agua fresca")));
  for (const record of batch.records) {
    assert.ok(!("status" in record), "source reports do not declare a consequential cat status");
    assert.ok(!["address", "lat", "lng", "latitude", "longitude", "phone", "email"].some(field => field in record));
    for (const attachment of record.attachments) await access(new URL(`../../public${attachment.fixturePath}`, import.meta.url));
  }
});

test("weekend identity proposals retain duplicate candidates and migration without automatic merging", async () => {
  const prepared = prepareSyntheticImport(fixture);
  const duplicates = prepared.messages.filter(message => message.review.some(review => review.kind === "possible_duplicate"));
  assert.deepEqual(new Set(duplicates.map(message => message.proposedCatKey)), new Set(["CAT-W-GUAVA-ALT", "CAT-W-COCO-ALT"]));
  assert.ok(duplicates.every(message => message.assignmentState === "unmatched"));
  assert.equal(new Set(prepared.messages.filter(message => message.proposedCatKey === "CAT-W-GUAVA").map(message => message.proposedColonyKey)).size, 2);
  assert.equal(new Set(prepared.messages.filter(message => message.proposedCatKey === "CAT-SKIPPER").map(message => message.proposedColonyKey)).size, 2);
  assert.equal(Object.keys(WEEKEND_CAT_META).length, 33);
  const stagedPhotos = {
    "CAT-W-GUAVA": "/demo-assets/guava-profile.png", "CAT-W-GUAVA-ALT": "/demo-assets/guava-alternate.png",
    "CAT-W-COCO": "/demo-assets/coco-profile.png", "CAT-W-COCO-ALT": "/demo-assets/coco-alternate.png",
  };
  const photoBytes = [];
  for (const path of Object.values(stagedPhotos)) photoBytes.push(await readFile(new URL("../../public" + path, import.meta.url)));
  for (let i = 0; i < photoBytes.length; i++) for (let j = i + 1; j < photoBytes.length; j++) assert.notDeepEqual(photoBytes[i], photoBytes[j], "staged viewpoints must be distinct images");
  for (const [key, source] of Object.entries(fixture.catCatalog)) {
    assert.equal(WEEKEND_CAT_META[key].name, source.name);
    assert.equal(WEEKEND_CAT_META[key].photo, stagedPhotos[key] ?? null, "only cats with dedicated staged evidence receive photos");
    assert.equal(WEEKEND_CAT_DETAILS[key].markings, source.markings);
    assert.ok(WEEKEND_CAT_DETAILS[key].estimated_dob.includes("fictional"));
  }
  assert.ok(fixture.fixtureGuide.rawCompanionBoundary.includes("remain unmatched"));
});

test("weekend raw companions preserve all source messages and photos without inventing new-name identity support", async () => {
  const [text, ndjson] = await Promise.all([
    readFile(new URL("../../public/demo-data/synthetic-weekend-whatsapp.txt", import.meta.url), "utf8"),
    readFile(new URL("../../public/demo-data/synthetic-weekend-sms.ndjson", import.meta.url), "utf8"),
  ]);
  const whatsapp = parseSyntheticWhatsAppExport({ batchId: "weekend-wa-test", provenance: fixture.provenance, text });
  const sms = parseSyntheticSmsRelay({ batchId: "weekend-sms-test", provenance: fixture.provenance, ndjson });
  assert.equal(whatsapp.records.length, 36);
  assert.equal(sms.records.length, 36);
  assert.deepEqual(new Set(whatsapp.records.map(record => record.broadArea)), new Set(areas));
  assert.deepEqual(new Set(sms.records.map(record => record.broadArea)), new Set(areas));
  assert.equal(whatsapp.records.reduce((sum, record) => sum + record.attachments.length, 0), 3);
  assert.equal(sms.records.reduce((sum, record) => sum + record.attachments.length, 0), 1);
  assert.equal(whatsapp.records.find(record => record.text.includes("Guava ya vino"))?.proposedCatKey, null);
  assert.equal(whatsapp.records.find(record => record.text.includes("split-face calico"))?.proposedCatKey, "CAT-04");
  assert.ok([...whatsapp.records, ...sms.records].every(record => record.proposedColonyKey !== "COL-07" || record.broadArea === "North Miami"));
  assert.equal(prepareSyntheticImport(whatsapp).messages.length + prepareSyntheticImport(sms).messages.length, 72);
});
