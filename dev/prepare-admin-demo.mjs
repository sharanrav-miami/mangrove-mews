/** Additive rehearsal data only. Never run against hosted or real-rescue data. */
import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importSyntheticFixture } from '../worker/intake.js';
import { seedCanonicalCatsFromObservations, materializeCanonicalCensus } from '../worker/census.js';
import { triageReport } from '../worker/triage-agent.js';

export function assertDemoDatabase(sqlite) {
  const users=sqlite.prepare('SELECT email FROM users').all();
  if(!users.length || users.some(user=>!/^(admin|coordinator|volunteer|sponsor)@mangrovemews\.demo$/.test(user.email))) throw new Error('Only the isolated synthetic local demo is permitted.');
  if(sqlite.prepare('SELECT 1 FROM intake_import_batches WHERE fixture_only!=1 LIMIT 1').get()) throw new Error('Non-fixture evidence found; preparation stopped.');
}
export async function seedSourcePacks(sqlite, root=process.cwd()) {
  assertDemoDatabase(sqlite);
  function prepare(sql) {const query=sqlite.prepare(sql);const bind=(...args)=>({run:async()=>{const out=query.run(...args);return {meta:{changes:Number(out.changes)}};},first:async()=>query.get(...args)??null,all:async()=>({results:query.all(...args)})});return{bind,run:()=>bind().run(),first:()=>bind().first(),all:()=>bind().all()};}
  const db={prepare,async batch(items){sqlite.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  for(const file of ['synthetic-intake-batch.json','synthetic-followup-shift.json','synthetic-weekend-shift.json']) {
    const fixture=JSON.parse(readFileSync(resolve(root,'public/demo-data',file),'utf8'));
    // Preparation never replays or reconciles historical sources. Add only
    // absent registered IDs, leaving legacy evidence and decisions untouched.
    const aliases=fixture.batchId==='fixture-south-florida-2026-11-07-a'?[fixture.batchId,'live-shift-v1']:[fixture.batchId];
    const existing=new Set(aliases.flatMap(alias=>sqlite.prepare("SELECT source_kind,source_message_id FROM intake_source_messages WHERE batch_id=? OR batch_id=?||'-'||source_message_id").all(alias,alias)).map(row=>row.source_kind+':'+row.source_message_id));
    fixture.records=fixture.records.filter(record=>!existing.has(record.sourceKind+':'+record.id));
    if(!fixture.records.length)continue;
    await importSyntheticFixture({db,fixture,assessRecord:record=>triageReport({message:record.text,source:record.sourceKind,catCount:record.count?.high},{})});
  }
  await seedCanonicalCatsFromObservations(db);await materializeCanonicalCensus(db);
}
export function prepareAdminDemo(sqlite, { now = new Date().toISOString() } = {}) {
  const users = sqlite.prepare('SELECT id,email,role FROM users').all();
  if (!users.length || users.some(user => !/^(admin|coordinator|volunteer|sponsor)@mangrovemews\.demo$/.test(user.email))) throw new Error('Only the isolated synthetic local demo is permitted.');
  const admin = users.find(user => user.role === 'admin')?.id;
  const volunteer = users.find(user => user.role === 'volunteer')?.id;
  if (!admin || !volunteer || !sqlite.prepare("SELECT 1 FROM canonical_colonies WHERE colony_key='COL-02'").get()) throw new Error('Start dev:full and import the synthetic packs before preparing admin scenarios.');
  const stamp = hours => new Date(Date.parse(now) + hours * 3600000).toISOString();
  let inserted = 0;
  const put = (table, row) => {
    const names = Object.keys(row); inserted += Number(sqlite.prepare(`INSERT OR IGNORE INTO ${table} (${names.join(',')}) VALUES (${names.map(()=>'?').join(',')})`).run(...Object.values(row)).changes);
  };
  const seedEvent = (table, foreign, id, detail = 'Staged fictional rehearsal history; no real field action occurred.') => put(table, {id:'ADMIN-DEMO-EVENT-'+id,[foreign]:id,actor_id:admin,...(table==='care_case_events'?{action:'created',summary:detail}:table==='community_review_events'?{action:'created',summary:detail}:table==='search_task_audit'?{event:'synthetic_seed',detail_json:JSON.stringify({synthetic:true,note:detail})}: {action:'synthetic_seed'}),created_at:now});
  const baseFeeding = { colony_key:'COL-02',created_by:admin,created_at:now };
  for (const [suffix,user,hours,status] of [['OVERDUE',admin,-2,'scheduled'],['BEACH',volunteer,3,'scheduled'],['DONE',admin,-5,'completed']]) {
    const id='ADMIN-DEMO-FEED-'+suffix;put('feeding_assignments',{id,...baseFeeding,colony_key:suffix==='BEACH'?'COL-MB-DEMO':'COL-02',assigned_user_id:user,due_at:stamp(hours),status,completed_at:status==='completed'?stamp(-4):null});
    seedEvent('field_assignment_events','assignment_id',id);
  }
  for(const [suffix,cat,kind,title,status,outcome] of [
    ['POPPY','CAT-04','medical','Fictional Poppy paw assessment','open',null],
    ['COAL-TNR','CAT-COAL','tnr','Fictional Coal TNR planning','open',null],
    ['PEARL','CAT-W-PEARL','medical','Fictional pregnancy care coordination','open',null],
    ['LUNA-RESOLVED','CAT-W-LUNA','medical','Fictional Luna follow-up documented','resolved','medical_resolved'],
    ['MISO-TNR','CAT-W-MISO','tnr','Fictional Miso TNR completed','resolved','tnr_completed'],
  ]) {
    if(!sqlite.prepare('SELECT 1 FROM canonical_cats WHERE cat_key=?').get(cat)) continue;
    const id='ADMIN-DEMO-CARE-'+suffix;
    put('care_cases',{id,canonical_cat_key:cat,case_kind:kind,priority:status==='open'?'urgent':'normal',title,detail:'Synthetic rehearsal case only. Demonstrates separate care planning and documented outcomes, not a veterinary diagnosis.',status,outcome,evidence_note:outcome?'Staged fictional clinic handoff and recovery note for the demo. No actual treatment occurred.':null,opened_by:admin,opened_at:'2026-11-08T12:00:00.000Z',resolved_by:outcome?admin:null,resolved_at:outcome?'2026-11-08T17:00:00.000Z':null});
    seedEvent('care_case_events','care_case_id',id);
    if(outcome)put('care_case_events',{id:'ADMIN-DEMO-OUTCOME-'+suffix,care_case_id:id,actor_id:admin,action:'resolved',summary:'Staged fictional documented outcome for sponsor-report rehearsal.',created_at:'2026-11-08T17:00:00.000Z'});
  }
  for(const [suffix,status,hours] of [['ASSIGNED','assigned',2],['BLOCKED','blocked',-1],['COMPLETE','completed',-3]]) {
    const id='ADMIN-DEMO-SEARCH-'+suffix;
    put('search_tasks',{id,title:{ASSIGNED:'Fictional quiet-cover check from public sidewalk',BLOCKED:'Fictional floodwater check — do not dispatch',COMPLETE:'Fictional courtyard observation completed'}[suffix],broad_area:'Miami Beach',canonical_cat_key:null,fictional_latitude:null,fictional_longitude:null,assigned_user_id:admin,status,safe_public_access:status==='blocked'?0:1,no_floodwater_or_drains:status==='blocked'?0:1,no_traffic_entry:1,risk_verified_human:status==='blocked'?0:1,risk_verified_at:status==='blocked'?null:now,forecast_source:'Synthetic rehearsal forecast; not current weather clearance',forecast_severity:status==='blocked'?'severe':'watch',forecast_checked_at:now,created_by:admin,created_at:now,due_at:stamp(hours),completed_at:status==='completed'?stamp(-2):null,blocked_at:status==='blocked'?stamp(-1):null,evidence_timestamp:status==='assigned'?null:stamp(-1),evidence_note:status==='assigned'?null:'Fictional rehearsal evidence: no real site was visited.',block_reason:status==='blocked'?'Staged flood-risk example. Do not enter floodwater, drains, traffic, or private property.':null});
    seedEvent('search_task_audit','task_id',id);
  }
  const uncertain=sqlite.prepare("SELECT id FROM intake_observations WHERE (colony_confidence<0.75 OR source_count_low!=source_count_high) ORDER BY id LIMIT 2").all();
  uncertain.forEach((row,index)=>{
    const id='ADMIN-DEMO-CLARIFY-'+index;const replied=index===1;
    put('intake_clarifications',{id,observation_id:row.id,requested_by:admin,assigned_user_id:admin,request_message:'Fictional demo: were the kittens counted individually, and which broad area did you observe?',state:replied?'replied':'open',reply_message:replied?'Staged reply: I could distinguish three kittens from a public path; the fourth shape was a bag.':null,reply_evidence:replied?'Fictional follow-up note; coordinator verification still required.':null,replied_by:replied?admin:null,requested_at:now,replied_at:replied?now:null,resolved_at:null});
    put('intake_confirmation_events',{id:'ADMIN-DEMO-CLARIFY-EVENT-'+index,observation_id:row.id,clarification_id:id,actor_id:admin,action:'clarification_requested',summary:'Staged synthetic clarification assigned to the admin for rehearsal.',created_at:now});
    if(replied)put('intake_confirmation_events',{id:'ADMIN-DEMO-CLARIFY-REPLY-'+index,observation_id:row.id,clarification_id:id,actor_id:admin,action:'clarification_replied',summary:'Staged synthetic reply preserved separately from source count.',created_at:now});
  });
  for(const [suffix,status,name] of [['PENDING','pending_review','Fictional Pebble lead'],['CLOSED','closed_unconfirmed','Fictional unconfirmed orange-cat lead']]) {
    const id='ADMIN-DEMO-MISSING-'+suffix;
    put('missing_cases',{id,canonical_cat_key:null,reported_name:name,description:'Invented rehearsal lead with uncertain identity. A manager must review before linking or marking any cat missing.',last_seen_area:'North Miami',last_seen_at:stamp(-6),photo_ref:null,status,created_by:admin,created_at:now,closed_by:status==='closed_unconfirmed'?admin:null,closed_at:status==='closed_unconfirmed'?now:null,decision_reason:status==='closed_unconfirmed'?'Staged fictional lead closed without identity confirmation.':null});
    put('missing_case_audit',{id:'ADMIN-DEMO-MISSING-EVENT-'+suffix,case_id:id,actor_id:admin,event:'synthetic_seed',detail_json:'{"synthetic":true,"no_cat_status_changed":true}',created_at:now});
  }
  for(const [suffix,status,user,hours] of [['DUE','scheduled',admin,-1],['FUTURE','scheduled',admin,3],['DONE','completed',volunteer,-5]]) {
    const id='ADMIN-DEMO-APPT-'+suffix;
    put('field_appointments',{id,cat_key:'CAT-04',kind:'follow_up',title:'Fictional Poppy '+suffix.toLowerCase()+' transport',clinic_label:'Demo care partner — fictional',broad_area:'Little Havana',due_at:stamp(hours),assigned_user_id:user,status,evidence_note:status==='completed'?'Staged handoff complete; does not establish a medical outcome.':null,created_by:admin,created_at:now,updated_at:now});
    put('field_tool_events',{id:'ADMIN-DEMO-EVENT-'+id,entity_kind:'appointment',entity_id:id,actor_id:admin,action:'synthetic_seed',detail_json:'{"synthetic":true}',created_at:now});
  }
  for(const [suffix,status,item,quantity] of [['FOOD','open','wet_food',12],['TRAPS','open','trap',2],['DELIVERED','fulfilled','carrier',2]]) {
    const id='ADMIN-DEMO-SUPPLY-'+suffix;
    put('supply_requests',{id,colony_key:'COL-02',item_kind:item,quantity,note:'Fictional rehearsal request for the Little River shift. Units are item counts.',needed_by:stamp(4),status,resolution_note:status==='fulfilled'?'Staged fictional delivery acknowledged by the demo admin.':null,created_by:admin,created_at:now,closed_at:status==='fulfilled'?now:null});
    put('supply_pledges',{id:'ADMIN-DEMO-PLEDGE-'+suffix,request_id:id,user_id:admin,quantity:suffix==='FOOD'?4:quantity,updated_at:now});
    put('field_tool_events',{id:'ADMIN-DEMO-EVENT-'+id,entity_kind:'supply',entity_id:id,actor_id:admin,action:'synthetic_seed',detail_json:'{"synthetic":true}',created_at:now});
  }
  for(const [suffix,status] of [['URGENT','open'],['ACKNOWLEDGED','open'],['CLOSED','closed']]) {
    const id='ADMIN-DEMO-HANDOFF-'+suffix;
    put('daily_handoffs',{id,cat_key:'CAT-04',colony_key:'COL-04',title:'Fictional Poppy '+suffix.toLowerCase()+' handoff',detail:'Staged admin rehearsal: check the care source, confirm transport, and leave a clear next-shift note. No real visit occurred.',priority:suffix==='URGENT'?'urgent':'normal',owner_user_id:admin,status,resolution_note:status==='closed'?'Staged transport handoff documented; medical outcome is separate.':null,created_by:admin,created_at:now,closed_at:status==='closed'?now:null});
    if(suffix!=='URGENT')put('handoff_acknowledgements',{id:'ADMIN-DEMO-ACK-'+suffix,handoff_id:id,user_id:admin,created_at:now});
    put('field_tool_events',{id:'ADMIN-DEMO-EVENT-'+id,entity_kind:'handoff',entity_id:id,actor_id:admin,action:'synthetic_seed',detail_json:'{"synthetic":true}',created_at:now});
  }
  for(const [suffix,classification,status,area,title] of [['LOST','missing-cat','queued','Miami Beach','Fictional tabby lead near a broad Beach area'],['COLONY','colony-lead','queued','Hollywood / Broward','Fictional recurring feeding-group observation'],['VERIFIED','colony-lead','verified','Little River','Fictional lead reviewed for follow-up'],['DISMISSED','not-actionable','dismissed','Hialeah','Fictional non-actionable repost']]) {
    const id='ADMIN-DEMO-COMMUNITY-'+suffix;
    put('community_reviews',{id,created_by:admin,classification,broad_area:area,assessment_mode:'demo',title,safe_summary:'Deliberately fictional, broad-area rehearsal lead. No live post, contact, URL, handle, or exact pin was retained.',status,fictional_only:1,created_at:now,decided_by:status==='queued'?null:admin,decided_at:status==='queued'?null:now});
    seedEvent('community_review_events','review_id',id);
    if(status!=='queued')put('community_review_events',{id:'ADMIN-DEMO-DECIDE-'+suffix,review_id:id,actor_id:admin,action:status,summary:'Staged fictional review decision; no cat or colony was automatically created.',created_at:now});
  }
  return {inserted,disclaimer:'Additive synthetic rehearsal rows only. No source, merge, canonical status, or model result was changed.'};
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href) {
  if(process.env.MEWS_LOCAL_DEMO!=='1')throw new Error('Run with MEWS_LOCAL_DEMO=1; this script is only for the loopback synthetic demo.');
  const root=process.cwd(),path=resolve(root,'.wrangler/local-demo/mews.sqlite');
  if(!existsSync(resolve(root,'dev/local-api.mjs'))||!existsSync(path))throw new Error('Run from the Mews repository after starting dev:full.');
  const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  assertDemoDatabase(sqlite);
  const backupPath=join(resolve(root,'.wrangler/local-demo'),'admin-demo-backup-'+Date.now()+'.sqlite');
  await backup(sqlite,backupPath);
  await seedSourcePacks(sqlite,root);
  let result;
  sqlite.exec('BEGIN IMMEDIATE');
  try { result=prepareAdminDemo(sqlite); sqlite.exec('COMMIT'); } catch(error) {sqlite.exec('ROLLBACK');sqlite.close();throw error;}
  const photoDir=resolve(root,'.wrangler/local-demo/photos');mkdirSync(photoDir,{recursive:true});
  const adminId=String(sqlite.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get().id);
  for(const [id,file,status] of [['aaaaaaaa-1111-4111-8111-111111111111','poppy-calico-limp.png','pending'],['bbbbbbbb-2222-4222-8222-222222222222','marmalade-orange-tabby.png','approved']]) {
    const source=resolve(root,'public/demo-assets',file),target=join(photoDir,id),bytes=readFileSync(source);
    if(!existsSync(target))copyFileSync(source,target);
    sqlite.prepare('INSERT OR IGNORE INTO private_photos(id,object_key,content_type,size_bytes,uploaded_by,review_status,created_at,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'private/'+id,'image/png',bytes.length,adminId,status,new Date().toISOString(),status==='approved'?adminId:null,status==='approved'?new Date().toISOString():null);
  }
  const counts={};for(const table of ['feeding_assignments','care_cases','search_tasks','intake_clarifications','missing_cases','field_appointments','supply_requests','daily_handoffs','community_reviews','private_photos','vision_comparisons'])counts[table]=sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  sqlite.close();console.log(JSON.stringify({...result,backup:backupPath,counts},null,2));
}
