import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Compass, Crosshair, Database, FlaskConical, Image, LogOut, Menu, MessageSquare, PawPrint, Settings2, Upload, X } from "lucide-react";
import { LoginPage } from "./components/LoginPage";
import { CatCompanion } from "./components/CatCompanion";
import { CatCursor } from "./components/CatCursor";
import { StoredCatNavigator } from "./components/StoredCatNavigator";
import { ConnectedFieldMap } from "./components/ConnectedFieldMap";
import { SharedIntake } from "./components/SharedIntake";
import { DurableOutbox } from "./components/DurableOutbox";
import { AgentEvaluation } from "./components/AgentEvaluation";
import { CommunitySignals } from "./components/CommunitySignals";
import { LiveShift } from "./components/LiveShift";
import { FieldSchedule } from "./components/FieldSchedule";
import { FieldSearchTasks } from "./components/FieldSearchTasks";
import { OutcomeReports } from "./components/OutcomeReports";
import { PhoneReport } from "./components/PhoneReport";
import { PhotoMatchReview } from "./components/PhotoMatchReview";
import { CatDirectory } from "./components/CatDirectory";
import { deliverFieldOutbox } from "./lib/field-outbox";
import { TodayBoard } from "./components/TodayBoard";
import { IntakeReview } from "./components/IntakeReview";
import { MissingCases } from "./components/MissingCases";
import { VisionMatch } from "./components/VisionMatch";
import { FieldTools } from "./components/FieldTools";
import { WorkspaceSearch } from "./components/WorkspaceSearch";
import { MyShift } from "./components/MyShift";

import { AUTH_CHANGED_EVENT, destinationAfterLogin, accountIdentity, canOpenWorkspaceView, createWorkspaceRequestGate, isWorkspaceView, navigationForRole, notificationReadKey, readNotificationIds, workspaceAlerts, workspaceEntry } from "./lib/workspace-navigation";
import type { NotificationReview, ShiftAttention, WorkspaceAlert, WorkspaceUser, WorkspaceView } from "./lib/workspace-navigation";
import "./components/WorkspaceNavigation.css";

const icons = {
  overview: Database, "my-shift": CalendarDays, "workspace-search": Compass, report: PawPrint,
  "intake-review": MessageSquare, imports: Upload, map: Compass, cats: PawPrint, matches: Image,
  vision: Image, lost: Crosshair, missing: Crosshair, photos: Image, schedule: CalendarDays,
  "field-tools": CalendarDays, "search-tasks": Crosshair, outcomes: Database,
  evaluation: FlaskConical, community: MessageSquare,
};
type AlertStatus = "loading" | "ready" | "partial" | "unavailable" | "signed-out" | "not-applicable";
class WorkspaceHttpError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
function restoreRead(user: WorkspaceUser) {
  try { return readNotificationIds(JSON.parse(localStorage.getItem(notificationReadKey(user)) ?? "[]")); }
  catch { return []; }
}
function persistPreference(key:string,value:boolean) { try { localStorage.setItem(key,String(value)); } catch { /* Preferences remain active for this page. */ } }
function restorePreference(key:string) { try { return localStorage.getItem(key)==="true"; } catch { return false; } }
function validUser(value:unknown):value is WorkspaceUser {
  const user=value as Partial<WorkspaceUser>|null;
  return Boolean(user&&Number.isInteger(user.id)&&Number(user.id)>0&&typeof user.email==="string"&&["admin","coordinator","volunteer","sponsor"].includes(user.role??""));
}

export function Workspace({ photos }: { photos?: React.ReactNode }) {
  const [view,setView]=useState<WorkspaceView|"login">(()=>location.hash==="#login"?"login":isWorkspaceView(location.hash.slice(1))?location.hash.slice(1) as WorkspaceView:"overview");
  const [menu,setMenu]=useState(false),[settings,setSettings]=useState(false),[notifications,setNotifications]=useState(false);
  const [user,setUser]=useState<WorkspaceUser|null>(null),[sessionChecked,setSessionChecked]=useState(false),[sessionNotice,setSessionNotice]=useState("");
  const [alerts,setAlerts]=useState<WorkspaceAlert[]>([]),[alertStatus,setAlertStatus]=useState<AlertStatus>("loading"),[read,setRead]=useState<string[]>([]),[visibleAlerts,setVisibleAlerts]=useState(20);
  const [compact,setCompact]=useState(()=>restorePreference("mews-compact")),[contrast,setContrast]=useState(()=>restorePreference("mews-contrast"));
  const [largeText,setLargeText]=useState(()=>restorePreference("mews-large-text")),[reduceMotion,setReduceMotion]=useState(()=>restorePreference("mews-reduce-motion"));
  const [catCursor,setCatCursor]=useState(()=>{try{return localStorage.getItem("mews-cat-cursor")!=="false";}catch{return true;}});
  useEffect(()=>persistPreference("mews-cat-cursor",catCursor),[catCursor]);
  const [mobile,setMobile]=useState(()=>matchMedia("(max-width: 760px)").matches);
  const mainRef=useRef<HTMLElement>(null),sidebarRef=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null);
  const notificationsButton=useRef<HTMLButtonElement>(null),settingsButton=useRef<HTMLButtonElement>(null),popoverRef=useRef<HTMLElement>(null);
  const currentUser=useRef<WorkspaceUser|null>(null),gate=useRef(createWorkspaceRequestGate());
  const defaultAfterSignIn=useRef(!location.hash);
  const returnAfterSignIn=useRef<WorkspaceView|null>(null);
  const authTransition=useRef(false);
  useEffect(()=>{const retry=()=>void deliverFieldOutbox();addEventListener("online",retry);addEventListener("mews-data-changed",retry);retry();return()=>{removeEventListener("online",retry);removeEventListener("mews-data-changed",retry);};},[]);
  useEffect(()=>{
    document.documentElement.dataset.demoDensity=compact?"compact":"comfortable";
    document.documentElement.dataset.demoTheme=contrast?"contrast":"meadow";
    document.documentElement.dataset.largeText=String(largeText);document.documentElement.dataset.reduceMotion=String(reduceMotion);
    persistPreference("mews-compact",compact);persistPreference("mews-contrast",contrast);persistPreference("mews-large-text",largeText);persistPreference("mews-reduce-motion",reduceMotion);
  },[compact,contrast,largeText,reduceMotion]);
  useEffect(()=>{const query=matchMedia("(max-width: 760px)");const update=()=>{setMobile(query.matches);if(!query.matches)setMenu(false);};query.addEventListener("change",update);return()=>query.removeEventListener("change",update);},[]);
  useEffect(()=>{const change=()=>{const next=location.hash.slice(1);if(next==="login"||isWorkspaceView(next)){setView(next);setMenu(false);setNotifications(false);setSettings(false);}};addEventListener("hashchange",change);return()=>removeEventListener("hashchange",change);},[]);
  useEffect(()=>{
    let disposed=false,controller:AbortController|null=null;
    const active=(ticket:number)=>!disposed&&gate.current.isCurrent(ticket);
    function clearIdentity(notice="") {
      currentUser.current=null;setUser(null);setAlerts([]);setRead([]);setVisibleAlerts(20);setNotifications(false);setSettings(false);setSessionChecked(true);setSessionNotice(notice);setAlertStatus("signed-out");
    }
    async function getJson(path:string,signal:AbortSignal) {
      const response=await fetch(path,{credentials:"same-origin",cache:"no-store",signal});
      if(!response.ok)throw new WorkspaceHttpError(response.status,response.status===401?"Your session has ended. Sign in again.":"This data source is unavailable.");
      if(!response.headers.get("content-type")?.includes("application/json"))throw new Error("Backend unavailable");
      return response.json();
    }
    async function sync() {
      const ticket=gate.current.begin();controller?.abort();const request=new AbortController();controller=request;
      try {
        const session=await getJson("/api/auth/session",request.signal);
        if(!active(ticket))return;
        if(!validUser(session.user))throw new Error("Session identity unavailable");
        const next=session.user;
        if(accountIdentity(next)!==accountIdentity(currentUser.current)) {
          setAlerts([]);setRead(restoreRead(next));setVisibleAlerts(20);setNotifications(false);setSettings(false);
        }
        currentUser.current=next;setUser(next);setSessionChecked(true);setSessionNotice("");
        if(authTransition.current) {
          const requested=destinationAfterLogin(next.role,returnAfterSignIn.current);returnAfterSignIn.current=null;authTransition.current=false;defaultAfterSignIn.current=false;location.hash=requested;setView(requested);
        }else if(defaultAfterSignIn.current) {
          defaultAfterSignIn.current=false;
          if(next.role==="volunteer"&&(!location.hash||location.hash==="#overview")){location.hash="my-shift";setView("my-shift");}
        }
        if(next.role==="sponsor"){setAlerts([]);setAlertStatus("not-applicable");return;}
        const manager=next.role==="admin"||next.role==="coordinator";
        const paths=manager?["/api/private/intake","/api/private/my-shift"]:["/api/private/my-shift"];
        const resources=await Promise.allSettled(paths.map(path=>getJson(path,request.signal)));
        if(!active(ticket)||accountIdentity(next)!==accountIdentity(currentUser.current))return;
        if(resources.some(result=>result.status==="rejected"&&result.reason instanceof WorkspaceHttpError&&result.reason.status===401)){clearIdentity("Your session has ended. Sign in again to see private notifications.");return;}
        const intake=manager&&resources[0].status==="fulfilled"?resources[0].value:null;
        const shiftResult=resources[manager?1:0];
        const shift=shiftResult.status==="fulfilled"&&shiftResult.value.userId===next.id?shiftResult.value as ShiftAttention:null;
        const successes=Number(Boolean(intake))+Number(Boolean(shift));
        setAlerts(workspaceAlerts({user:next,reviews:(intake?.reviews??[]) as NotificationReview[],shift}));
        setAlertStatus(successes===paths.length?"ready":successes?"partial":"unavailable");
      }catch(error){
        if(!active(ticket)||request.signal.aborted)return;
        clearIdentity(error instanceof WorkspaceHttpError&&error.status===401?"":"Unable to verify your session. Refresh or open team sign-in.");
        if(!(error instanceof WorkspaceHttpError&&error.status===401))setAlertStatus("unavailable");
      }
    }
    function authChanged() {
      gate.current.invalidate();controller?.abort();defaultAfterSignIn.current=!location.hash||location.hash==="#overview";
      authTransition.current=true;
      clearIdentity();setSessionChecked(false);setAlertStatus("loading");void sync();
    }
    const dataChanged=()=>void sync();
    void sync();const timer=setInterval(()=>void sync(),15000);
    addEventListener("mews-data-changed",dataChanged);addEventListener(AUTH_CHANGED_EVENT,authChanged);
    return()=>{disposed=true;gate.current.invalidate();controller?.abort();clearInterval(timer);removeEventListener("mews-data-changed",dataChanged);removeEventListener(AUTH_CHANGED_EVENT,authChanged);};
  },[]);
  useEffect(()=>{
    if(sessionChecked&&!user&&view!=="login"&&view!=="map") {
      if(view!=="overview")returnAfterSignIn.current=view;
      setView("login");location.hash="login";
    }
  },[sessionChecked,user,view]);
  useEffect(()=>{
    if(!menu||!mobile)return;
    const previous=document.activeElement as HTMLElement|null;
    const first=sidebarRef.current?.querySelector<HTMLElement>('a[aria-current="page"],button');first?.focus();
    const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
    function trap(event:KeyboardEvent) {
      if(event.key!=="Tab")return;
      const targets=Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')??[]);
      const first=targets[0],last=targets[targets.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    addEventListener("keydown",trap);
    return()=>{document.body.style.overflow=overflow;removeEventListener("keydown",trap);previous?.focus({preventScroll:true});};
  },[menu,mobile]);
  useEffect(()=>{if(settings||notifications)popoverRef.current?.querySelector<HTMLElement>("h2")?.focus();},[settings,notifications]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key!=="Escape")return;if(menu){setMenu(false);menuButton.current?.focus();}if(notifications){setNotifications(false);notificationsButton.current?.focus();}if(settings){setSettings(false);settingsButton.current?.focus();}};
    addEventListener("keydown",escape);return()=>removeEventListener("keydown",escape);
  },[menu,notifications,settings]);
  function go(next:WorkspaceView|"login") {setView(next);setMenu(false);setNotifications(false);setSettings(false);location.hash=next;window.scrollTo({top:0});requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}));}
  function follow(event:React.MouseEvent<HTMLAnchorElement>,next:WorkspaceView) {if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(next);}
  function account(returnTo:WorkspaceView|"login"|null=null) {returnAfterSignIn.current=returnTo==="login"?null:returnTo;authTransition.current=false;go("login");}
  async function signOut() {
    const csrf=document.cookie.split("; ").find(item=>item.startsWith("mews_csrf="))?.slice(10)??"";
    const response=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",headers:{"X-CSRF-Token":csrf}});
    if(!response.ok)throw new Error("Unable to sign out. Your session has been kept; please retry.");
    returnAfterSignIn.current=null;go("login");dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
  function markRead(ids:string[]) {
    const account=currentUser.current;if(!account)return;
    setRead(previous=>{const next=readNotificationIds([...previous,...ids]);try{localStorage.setItem(notificationReadKey(account),JSON.stringify(next));}catch{/* Read state remains active in memory. */}return next;});
  }
  function openAlert(item:WorkspaceAlert) {markRead([item.id]);if(item.observationId)sessionStorage.setItem("mews-review-observation",item.observationId);if(item.fieldTab)sessionStorage.setItem("mews-field-tools-tab",item.fieldTab);go(item.view);}
  const loginVisible=view==="login"||(!user&&view!=="map");
  const unread=alerts.filter(item=>!read.includes(item.id));
  const badge=alertStatus==="loading"?"…":alertStatus==="unavailable"?"?":unread.length?`${unread.length}${alertStatus==="partial"?"+":""}`:alertStatus==="partial"?"?":null;
  const role=user?.role??null,current=workspaceEntry(view);
  const allowed=canOpenWorkspaceView(view,role);
  const notificationSummary=alertStatus==="loading"?"Checking notification sources…":alertStatus==="partial"?`${unread.length} known unread items. Some sources are unavailable; the total may be incomplete.`:alertStatus==="unavailable"?"Notifications are unavailable. Their count is unknown.":alertStatus==="not-applicable"?"Sponsor access shows aggregate outcomes. Private team notifications are not included.":!user?"Sign in to see your assigned work and notifications.":`${unread.length} unread of ${alerts.length} loaded open items needing attention.`;
  function renderView() {
    if(view!=="overview"&&view!=="map"&&!sessionChecked)return <section className="panel workspace-access-state" role="status"><h1>Checking team access</h1><p>Verifying your session before opening {current?.label??"this page"}.</p></section>;
    if(!allowed)return <section className="panel workspace-access-state"><p className="eyebrow">{user?"Role access":"Team sign-in required"}</p><h1>{current?.label??"Private workspace"}</h1><p>{user?`${user.role==='sponsor'?'Sponsor':user.role==='volunteer'?'Volunteer':'This account'} access does not include this page. ${current?.audience==='manager'?'An admin or coordinator can use this review desk.':'Use the pages available in your navigation, or sign in with an authorized account.'}`:"Sign in with a provisioned rescue team account to open this page. Your link is kept here so you can return after signing in."}</p><button className="primary-button" onClick={()=>account(view)}>{user?"Open account & sign-in":"Open team sign-in"}</button><a href="#map" className="secondary-button" onClick={event=>follow(event,"map")}>Open field map</a><p className="source-note">The server also checks permissions for every protected action.</p></section>;
    switch(view) {
      case "overview":return <><section className="page-heading"><div><p className="eyebrow">Fictional data · persistent care records</p><h1>Care, before it gets missed.</h1></div></section><TodayBoard/><CatCompanion compact/><SharedIntake/></>;
      case "imports":return <><section className="page-heading"><div><p className="eyebrow">Intentional exports and messages</p><h1>Import a field shift</h1></div></section><LiveShift/><DurableOutbox/></>;
      case "map":return <ConnectedFieldMap/>;
      case "lost":return <StoredCatNavigator/>;
      case "photos":return photos??<section className="panel"><h1>Private photo review</h1><p>Loading the photo workspace.</p></section>;
      case "evaluation":return <AgentEvaluation/>;
      case "community":return <CommunitySignals/>;
      case "schedule":return <FieldSchedule/>;
      case "search-tasks":return <FieldSearchTasks/>;
      case "outcomes":return <OutcomeReports/>;
      case "report":return <PhoneReport/>;
      case "matches":return <PhotoMatchReview/>;
      case "cats":return <CatDirectory/>;
      case "intake-review":return <IntakeReview/>;
      case "missing":return <MissingCases/>;
      case "vision":return <VisionMatch/>;
      case "field-tools":return <FieldTools/>;
      case "workspace-search":return <WorkspaceSearch/>;
      case "my-shift":return <MyShift/>;
    }
  }
  const cursor=<CatCursor enabled={catCursor} onToggle={()=>setCatCursor(value=>!value)}/>;
  if(loginVisible)return <><LoginPage user={user} checking={!sessionChecked} notice={sessionNotice} onSignedIn={()=>dispatchEvent(new Event(AUTH_CHANGED_EVENT))} onSignOut={signOut} onContinue={()=>go(destinationAfterLogin(user!.role,returnAfterSignIn.current))} onPublicMap={()=>{returnAfterSignIn.current=null;go("map");}}/>{cursor}</>;
  return <><div className="app-shell">
    <a className="workspace-skip-link" href="#workspace-main" onClick={event=>{event.preventDefault();mainRef.current?.focus();mainRef.current?.scrollIntoView({block:"start"});}}>Skip to main content</a>
    {menu&&mobile&&<button className="workspace-menu-overlay" aria-label="Close navigation overlay" tabIndex={-1} onClick={()=>setMenu(false)}/>}
    <aside ref={sidebarRef} id="workspace-navigation" className={menu?"sidebar mobile-open":"sidebar"} inert={mobile&&!menu?true:undefined} aria-hidden={mobile&&!menu?true:undefined} role={mobile&&menu?"dialog":undefined} aria-modal={mobile&&menu?true:undefined} aria-label="Workspace navigation">
      <div className="workspace-brand-row"><a className="brand" href="#overview" onClick={event=>follow(event,"overview")}><span className="brand-mark"><PawPrint size={23}/></span><span><b>Mangrove</b><em>Mews</em></span></a><button className="workspace-nav-close icon-button" aria-label="Close navigation" onClick={()=>setMenu(false)}><X size={19}/></button></div>
      <nav className="workspace-navigation" aria-label="Primary workspace navigation">{navigationForRole(role).map(group=><section key={group.label} aria-label={group.label}><h2>{group.label}</h2>{group.entries.map(entry=>{const Icon=icons[entry.id];return <a href={`#${entry.id}`} key={entry.id} aria-current={view===entry.id?"page":undefined} className={view===entry.id?"active":""} onClick={event=>follow(event,entry.id)}><Icon size={18}/><span>{entry.label}</span></a>;})}</section>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-note"><p className="eyebrow">Synthetic field workspace</p><p>Fictional cats and messages across Miami-Dade and Broward. Shared records are stored by the backend.</p></div><div className="profile"><i>{user?.role.slice(0,2).toUpperCase()??"MM"}</i><span><b>{user?.role??"Public preview"}</b><small>{user?"Server-verified session":"Sign in for team tools"}</small></span></div></div>
    </aside>
    <main ref={mainRef} id="workspace-main" tabIndex={-1}><header className="topbar">
      <button ref={menuButton} className="mobile-menu icon-button" onClick={()=>{setMenu(!menu);setNotifications(false);setSettings(false);}} aria-label={menu?"Close navigation":"Open navigation"} aria-expanded={menu} aria-controls="workspace-navigation"><Menu size={20}/></button>
      <div className="region"><span/><b>South Florida</b><small>{current?.label??"Care workspace"}</small></div>
      <div className="workspace-tools"><button ref={notificationsButton} className="icon-button" aria-label="Notifications" aria-expanded={notifications} aria-controls="workspace-notifications" aria-describedby="workspace-notification-status" onClick={()=>{setNotifications(!notifications);setSettings(false);setMenu(false);}}><Bell size={18}/>{badge&&<span className="workspace-count" aria-hidden="true">{badge}</span>}</button><span id="workspace-notification-status" className="workspace-visually-hidden">{notificationSummary}</span><button ref={settingsButton} className="icon-button" aria-label="Appearance settings" aria-expanded={settings} aria-controls="workspace-settings" onClick={()=>{setSettings(!settings);setNotifications(false);setMenu(false);}}><Settings2 size={18}/></button><button className="secondary-button workspace-profile" title={user?.email??"Open team sign-in"} onClick={()=>account(view)}>{user?.email??"Team sign in"}</button>{user&&<button className="icon-button" aria-label="Sign out" title="Sign out" onClick={()=>void signOut().catch(error=>setSessionNotice(error.message))}><LogOut size={18}/></button>}</div>
    </header>
    {settings&&<section ref={popoverRef} id="workspace-settings" className="workspace-popover" role="dialog" aria-labelledby="workspace-settings-title"><header><h2 id="workspace-settings-title" tabIndex={-1}>Appearance preferences</h2><button className="icon-button" aria-label="Close settings" onClick={()=>{setSettings(false);settingsButton.current?.focus();}}><X size={16}/></button></header><label><span>Compact layout</span><input type="checkbox" checked={compact} onChange={()=>setCompact(!compact)}/></label><label><span>High contrast</span><input type="checkbox" checked={contrast} onChange={()=>setContrast(!contrast)}/></label><label><span>Larger text and controls</span><input type="checkbox" checked={largeText} onChange={()=>setLargeText(!largeText)}/></label><label><span>Cat cursor</span><input type="checkbox" checked={catCursor} onChange={()=>setCatCursor(!catCursor)}/></label><label><span>Reduce interface motion</span><input type="checkbox" checked={reduceMotion} onChange={()=>setReduceMotion(!reduceMotion)}/></label><p>Saved on this device. Your team role is set by the server.</p></section>}
    {notifications&&<section ref={popoverRef} id="workspace-notifications" className="workspace-popover" role="dialog" aria-labelledby="workspace-notifications-title"><header><h2 id="workspace-notifications-title" tabIndex={-1}>{role==='volunteer'?"My notifications":"Review notifications"}</h2><button className="icon-button" aria-label="Close notifications" onClick={()=>{setNotifications(false);notificationsButton.current?.focus();}}><X size={16}/></button></header><p role="status">{notificationSummary}</p>{user&&role!=='sponsor'&&<p>{role==='volunteer'?"Only your assigned work appears here.":"Open team reviews, followed by your assignments. Urgent care appears first."} Read state is saved for this account on this device.</p>}{alerts.slice(0,visibleAlerts).map(item=><button key={item.id} className={`workspace-alert ${read.includes(item.id)?"is-read":"is-unread"}`} onClick={()=>openAlert(item)}><b>{item.title}{!read.includes(item.id)&&<em>Unread</em>}</b><span>{item.explanation}</span></button>)}{alertStatus==='ready'&&user&&alerts.length===0&&<p>No open items need your attention.</p>}{alerts.length>visibleAlerts&&<button className="secondary-button" onClick={()=>setVisibleAlerts(count=>count+20)}>Show more ({alerts.length-visibleAlerts} remaining)</button>}{alerts.length>0&&<button className="secondary-button workspace-mark-read" onClick={()=>markRead(alerts.map(item=>item.id))}>Mark all loaded items read</button>}{!user&&sessionChecked&&<button className="primary-button" onClick={()=>account()}>Open team sign-in</button>}</section>}
    <div className="content">{sessionNotice&&<p className="workspace-session-notice" role="status">{sessionNotice}</p>}{renderView()}</div></main>
  </div>{cursor}</>;
}
