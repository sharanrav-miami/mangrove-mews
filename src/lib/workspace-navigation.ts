export type WorkspaceRole = 'admin' | 'coordinator' | 'volunteer' | 'sponsor';
export type WorkspaceUser = { id: number; email: string; role: WorkspaceRole };
export type WorkspaceView = 'overview' | 'map' | 'lost' | 'imports' | 'photos' | 'evaluation' | 'community' | 'schedule' | 'search-tasks' | 'outcomes' | 'report' | 'matches' | 'cats' | 'intake-review' | 'missing' | 'vision' | 'field-tools' | 'workspace-search' | 'my-shift';
type Audience = 'everyone' | 'team' | 'manager' | 'reporting';
type NavigationEntry = { id: WorkspaceView; label: string; audience: Audience };
type NavigationGroup = { label: string; entries: NavigationEntry[] };
export const AUTH_CHANGED_EVENT = 'mews-auth-changed';

export const WORKSPACE_NAVIGATION: NavigationGroup[] = [
  { label: 'Workday', entries: [
    { id:'overview',label:'Care workspace',audience:'everyone' },
    { id:'my-shift',label:'My shift',audience:'team' },
    { id:'report',label:'New field report',audience:'team' },
    { id:'workspace-search',label:'Search records',audience:'team' },
  ] },
  { label:'Cats & map',entries:[
    { id:'map',label:'Field map',audience:'everyone' },
    { id:'cats',label:'Cat profiles & visits',audience:'team' },
    { id:'missing',label:'Missing-cat cases',audience:'team' },
    { id:'lost',label:'Lost cat navigator',audience:'team' },
  ] },
  { label:'Coordination',entries:[
    { id:'schedule',label:'Feeding schedule',audience:'team' },
    { id:'search-tasks',label:'Field-search tasks',audience:'team' },
    { id:'field-tools',label:'Field coordination',audience:'team' },
    { id:'intake-review',label:'Clarifications & routing',audience:'team' },
    { id:'photos',label:'Private photo review',audience:'team' },
    { id:'community',label:'Community signals',audience:'team' },
    { id:'outcomes',label:'Care outcomes & reports',audience:'reporting' },
  ] },
  { label:'Demo & admin',entries:[
    { id:'imports',label:'Chat imports & outbox',audience:'manager' },
    { id:'matches',label:'Photo match review',audience:'manager' },
    { id:'vision',label:'AI image comparison',audience:'manager' },
    { id:'evaluation',label:'Agent evaluation',audience:'manager' },
  ] },
];

export function workspaceEntry(view: string) { return WORKSPACE_NAVIGATION.flatMap(group=>group.entries).find(entry=>entry.id===view); }
export function isWorkspaceView(view:string): view is WorkspaceView { return Boolean(workspaceEntry(view)); }
export function canOpenWorkspaceView(view:string,role:WorkspaceRole|null):boolean {
  const audience=workspaceEntry(view)?.audience;
  if(audience==='everyone')return true;
  if(!role)return false;
  const manager=role==='admin'||role==='coordinator';
  return audience==='manager'?manager:audience==='reporting'?manager||role==='sponsor':audience==='team'?manager||role==='volunteer':false;
}
export function navigationForRole(role:WorkspaceRole|null) {
  return WORKSPACE_NAVIGATION.map(group=>({...group,entries:group.entries.filter(entry=>canOpenWorkspaceView(entry.id,role))})).filter(group=>group.entries.length>0);
}
export function accountIdentity(user:WorkspaceUser|null) { return user?`${user.id}:${user.role}:${user.email.trim().toLowerCase()}`:''; }
export function notificationReadKey(user:WorkspaceUser) { return 'mews-notification-read:v1:'+encodeURIComponent(accountIdentity(user)); }
export function readNotificationIds(value:unknown):string[] { return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=240))].slice(-2000):[]; }

export type NotificationReview = {id:string;observation_id?:string;explanation:string;review_kind:string;status:string};
export type ShiftAttentionItem = {id:string;observationId?:string;kind:string;title:string;area?:string;dueAt:string|null;status:string;view:string;overdue?:boolean};
export type ShiftAttention = {userId:number;items:ShiftAttentionItem[]};
export type WorkspaceAlert = {id:string;title:string;explanation:string;view:WorkspaceView;priority:number;observationId?:string;fieldTab?:'appointments'|'handoffs'};

/** The personal endpoint is scoped server-side; its user ID must also match the
 * session used for this request. Team review notifications are managers only. */
export function workspaceAlerts({user,reviews=[],shift=null,now=Date.now()}:{user:WorkspaceUser;reviews?:NotificationReview[];shift?:ShiftAttention|null;now?:number}):WorkspaceAlert[] {
  const alerts:WorkspaceAlert[]=[];
  if(user.role==='admin'||user.role==='coordinator')for(const review of reviews){
    if(review.status!=='open'||!review.id)continue;
    const urgent=review.review_kind==='urgent_care';
    alerts.push({id:'review:'+review.id,title:urgent?'Urgent care review':review.review_kind.replaceAll('_',' '),explanation:review.explanation,view:review.review_kind==='possible_duplicate'?'matches':'intake-review',priority:urgent?0:4,observationId:review.observation_id});
  }
  if(shift?.userId===user.id&&user.role!=='sponsor')for(const item of shift.items){
    const due=item.dueAt?Date.parse(item.dueAt):NaN;
    const overdue=Number.isFinite(due)&&due<now;
    const dueSoon=Number.isFinite(due)&&due<=now+86400000;
    const important=item.kind==='clarification'&&item.status==='reply_needed'||item.kind==='handoff'&&item.status==='acknowledgement_needed'||item.kind==='feeding'&&overdue||item.kind==='search'&&(overdue||item.status==='blocked')||item.kind==='appointment'&&dueSoon;
    if(!important||['completed','cancelled','closed','resolved'].includes(item.status)||!canOpenWorkspaceView(item.view,user.role))continue;
    alerts.push({id:`work:${item.kind}:${item.id}`,title:item.kind==='feeding'?'Feeding confirmation overdue':item.kind==='search'&&item.status==='blocked'?'Search task blocked':item.kind==='clarification'?'Your clarification needs a reply':item.kind==='handoff'?'Your handoff needs acknowledgement':'Care appointment due',explanation:item.title+(item.dueAt?' · '+(overdue?'confirmation overdue':'due within 24 hours'):''),view:item.view as WorkspaceView,priority:overdue||item.status==='blocked'||item.kind==='clarification'?1:2,observationId:item.observationId,fieldTab:item.kind==='appointment'?'appointments':item.kind==='handoff'?'handoffs':undefined});
  }
  return [...new Map(alerts.map(alert=>[alert.id,alert])).values()].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
}

/** A logout or a newer account request invalidates all previous responses. */
export function createWorkspaceRequestGate() {
  let revision=0;
  return {begin(){return ++revision;},invalidate(){revision+=1;},isCurrent(ticket:number){return ticket===revision;}};
}

/** Only known, role-permitted routes can be restored after sign-in. */
export function destinationAfterLogin(role:WorkspaceRole,requested:string|null):WorkspaceView {
  if(requested&&isWorkspaceView(requested)&&canOpenWorkspaceView(requested,role))return requested;
  return role==='volunteer'?'my-shift':'overview';
}
