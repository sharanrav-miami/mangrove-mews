import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';
import {prepareAdminDemo,seedSourcePacks,assertDemoDatabase} from '../../dev/prepare-admin-demo.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));for(const [i,role] of ['admin','coordinator','volunteer','sponsor'].entries())db.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at)VALUES(?,?,?,?,1,1)').run(i+1,role+'@mangrovemews.demo','test-only-inert-hash',role);return db;}
const count=(db,table)=>db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
test('admin preparation is additive/idempotent and preserves source, canonical status, and real vision results',async()=>{
 const db=setup();await seedSourcePacks(db);assert.equal(count(db,'intake_source_messages'),112);
 db.prepare("UPDATE canonical_cats SET status='missing' WHERE cat_key='CAT-11'").run();
 const before=db.prepare('SELECT * FROM intake_source_messages ORDER BY id').all();
 await seedSourcePacks(db);assert.equal(count(db,'intake_source_messages'),112);
 const first=prepareAdminDemo(db,{now:'2026-11-08T19:00:00Z'});assert.ok(first.inserted>0);
 const tables=['feeding_assignments','care_cases','search_tasks','intake_clarifications','missing_cases','field_appointments','supply_requests','daily_handoffs','community_reviews'];
 const counts=Object.fromEntries(tables.map(t=>[t,count(db,t)]));
 assert.equal(prepareAdminDemo(db,{now:'2026-11-09T19:00:00Z'}).inserted,0);
 assert.deepEqual(Object.fromEntries(tables.map(t=>[t,count(db,t)])),counts);
 assert.deepEqual(db.prepare('SELECT * FROM intake_source_messages ORDER BY id').all(),before);
 assert.equal(db.prepare("SELECT status FROM canonical_cats WHERE cat_key='CAT-11'").get().status,'missing');
 assert.equal(count(db,'vision_comparisons'),0,'preparation never fabricates AI outputs');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM care_cases WHERE status='resolved'").get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM search_tasks WHERE status='blocked' AND risk_verified_human=0").get().n,1);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM field_appointments WHERE assigned_user_id=1").get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM intake_clarifications WHERE state='replied'").get().n,1);
 db.close();
});
test('admin preparation rejects non-demo accounts before mutation',()=>{const db=setup();db.prepare("UPDATE users SET email='real@example.org' WHERE id=1").run();assert.throws(()=>assertDemoDatabase(db),/isolated synthetic/);assert.throws(()=>prepareAdminDemo(db),/isolated synthetic/);assert.equal(count(db,'feeding_assignments'),0);db.close();});
