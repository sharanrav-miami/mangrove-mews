import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationAfterLogin, canOpenWorkspaceView, createWorkspaceRequestGate, navigationForRole, notificationReadKey, readNotificationIds, workspaceAlerts } from '../../src/lib/workspace-navigation.ts';

const volunteer={id:3,email:'volunteer@mangrovemews.demo',role:'volunteer'};
const manager={id:1,email:'admin@mangrovemews.demo',role:'admin'};
const NOW=Date.parse('2026-11-08T14:00:00Z');
const pages=role=>navigationForRole(role).flatMap(group=>group.entries.map(entry=>entry.id));

test('audience navigation exposes useful pages without presenting unavailable review desks',()=>{
  assert.deepEqual(pages(null),['overview','map']);
  assert.deepEqual(pages('sponsor'),['overview','map','outcomes']);
  const fieldPages=pages('volunteer');
  for(const page of ['my-shift','report','cats','map','intake-review','photos','field-tools'])assert.ok(fieldPages.includes(page),page+' must stay available to field volunteers');
  for(const page of ['imports','vision','matches','evaluation'])assert.equal(fieldPages.includes(page),false,page+' must not appear as a volunteer review desk');
  assert.equal(canOpenWorkspaceView('vision','volunteer'),false);
  assert.equal(canOpenWorkspaceView('photos','volunteer'),true,'volunteers retain their own protected photo desk');
  assert.equal(canOpenWorkspaceView('cats','sponsor'),false);
  assert.equal(canOpenWorkspaceView('not-a-real-route','admin'),false);
  assert.ok(pages('coordinator').includes('vision'));
  assert.equal(new Set(pages('admin')).size,pages('admin').length,'a page must have one navigation location');
});

test('volunteer notifications ignore team review volume and accept only their own actionable shift',()=>{
  const reviews=Array.from({length:70},(_,index)=>({id:'team-'+index,status:'open',review_kind:'urgent_care',explanation:'Team evidence'}));
  const items=[
    {id:'own-feed',kind:'feeding',title:'My food visit',dueAt:'2026-11-08T13:00:00Z',status:'scheduled',view:'schedule'},
    {id:'future-feed',kind:'feeding',title:'Tomorrow food visit',dueAt:'2026-11-10T13:00:00Z',status:'scheduled',view:'schedule'},
    {id:'my-reply',kind:'clarification',observationId:'OBS:own',title:'Confirm the fictional count',dueAt:null,status:'reply_needed',view:'intake-review'},
    {id:'read-handoff',kind:'handoff',title:'Already acknowledged',dueAt:null,status:'acknowledged',view:'field-tools'},
    {id:'done-visit',kind:'appointment',title:'Completed logistics',dueAt:'2026-11-08T12:00:00Z',status:'completed',view:'field-tools'},
    {id:'due-visit',kind:'appointment',title:'Upcoming appointment',dueAt:'2026-11-09T10:00:00Z',status:'scheduled',view:'field-tools'},
  ];
  const notifications=workspaceAlerts({user:volunteer,reviews,shift:{userId:3,items},now:NOW});
  assert.equal(notifications.length,3);
  assert.ok(notifications.every(item=>item.id.startsWith('work:')));
  assert.equal(notifications.find(item=>item.observationId)?.observationId,'OBS:own');
  assert.equal(notifications.find(item=>item.fieldTab)?.fieldTab,'appointments');
  assert.deepEqual(workspaceAlerts({user:volunteer,reviews,shift:{userId:2,items},now:NOW}),[],'a delayed previous-account shift must never be shown');
  assert.deepEqual(workspaceAlerts({user:{...volunteer,role:'sponsor'},reviews,shift:{userId:3,items},now:NOW}),[]);
});

test('manager notifications prioritize open urgent reviews and never count resolved duplicate payloads',()=>{
  const reviews=[
    {id:'routine',review_kind:'uncertain_count',status:'open',explanation:'Count clarification'},
    {id:'urgent',observation_id:'OBS:urgent',review_kind:'urgent_care',status:'open',explanation:'Needs coordinator attention'},
    {id:'urgent',observation_id:'OBS:urgent',review_kind:'urgent_care',status:'open',explanation:'Needs coordinator attention'},
    {id:'done',review_kind:'urgent_care',status:'confirmed',explanation:'Resolved'},
  ];
  const result=workspaceAlerts({user:manager,reviews,shift:{userId:1,items:[{id:'blocked',kind:'search',title:'Access check blocked',dueAt:null,status:'blocked',view:'search-tasks'}]},now:NOW});
  assert.equal(result.length,3);assert.equal(result[0].id,'review:urgent');assert.equal(result[1].id,'work:search:blocked');
  assert.ok(!result.some(item=>item.id==='review:done'));
});

test('notification read storage is isolated by account and role, with bounded valid IDs',()=>{
  assert.notEqual(notificationReadKey(volunteer),notificationReadKey(manager));
  assert.notEqual(notificationReadKey(volunteer),notificationReadKey({...volunteer,role:'coordinator'}));
  assert.equal(notificationReadKey(volunteer),notificationReadKey({...volunteer,email:'VOLUNTEER@mangrovemews.demo'}));
  assert.deepEqual(readNotificationIds(['review:one',null,'review:one','work:feeding:two',9,'']),['review:one','work:feeding:two']);
  assert.deepEqual(readNotificationIds({corrupt:true}),[]);
  assert.equal(readNotificationIds(Array.from({length:2200},(_,index)=>'review:'+index)).length,2000);
});

test('late notification responses cannot cross an account change or logout boundary',async()=>{
  const gate=createWorkspaceRequestGate();let displayed=[];
  let releaseOld,releaseNew;
  const oldResult=new Promise(resolve=>{releaseOld=resolve;});
  const newResult=new Promise(resolve=>{releaseNew=resolve;});
  const publish=async(ticket,response)=>{const alerts=await response;if(gate.isCurrent(ticket))displayed=alerts;};
  const previous=publish(gate.begin(),oldResult);
  gate.invalidate();displayed=[]; // Immediate successful sign-out event.
  const current=publish(gate.begin(),newResult);
  releaseNew(['my new account task']);await current;
  releaseOld(['private previous account review']);await previous;
  assert.deepEqual(displayed,['my new account task']);
  const pending=gate.begin();gate.invalidate();
  assert.equal(gate.isCurrent(pending),false,'logout invalidates an unfinished request even before a new sign-in');
});


test('sign-in restores only permitted known routes and chooses useful account defaults',()=>{
  assert.equal(destinationAfterLogin('admin','matches'),'matches');
  assert.equal(destinationAfterLogin('coordinator','vision'),'vision');
  assert.equal(destinationAfterLogin('volunteer','vision'),'my-shift');
  assert.equal(destinationAfterLogin('sponsor','imports'),'overview');
  assert.equal(destinationAfterLogin('sponsor','outcomes'),'outcomes');
  assert.equal(destinationAfterLogin('volunteer',null),'my-shift');
  assert.equal(destinationAfterLogin('admin',null),'overview');
  for(const unknown of ['login','https://example.com','javascript:alert(1)','/admin','not-a-page'])assert.equal(destinationAfterLogin('admin',unknown),'overview');
});
