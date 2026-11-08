import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LogOut, MapPin, PawPrint, ShieldCheck } from "lucide-react";
import type { WorkspaceUser } from "../lib/workspace-navigation";
import "./LoginPage.css";

type Props = { user: WorkspaceUser | null; checking: boolean; notice: string; onSignedIn: () => void; onSignOut: () => Promise<void>; onContinue: () => void; onPublicMap: () => void };
export function LoginPage({user,checking,notice,onSignedIn,onSignOut,onContinue,onPublicMap}:Props) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [localDemo,setLocalDemo]=useState(false);
  useEffect(()=>{const controller=new AbortController();void fetch("/api/config",{signal:controller.signal,credentials:"same-origin"}).then(response=>response.ok?response.json():null).then(config=>setLocalDemo(config?.localDemo===true&&["localhost","127.0.0.1","[::1]"].includes(location.hostname))).catch(()=>{});return()=>controller.abort();},[]);
  async function signIn(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy||checking)return;setBusy(true);setError("");
    try {
      const response=await fetch("/api/auth/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password})});
      if(!response.headers.get("content-type")?.includes("application/json"))throw new Error("Sign-in is unavailable. Please try again when the server is running.");
      const body=await response.json();if(!response.ok)throw new Error(body.error??"Unable to sign in. Check your email and password.");
      setPassword("");onSignedIn();
    }catch(reason){setError(reason instanceof Error?reason.message:"Unable to sign in. Please try again.");}finally{setBusy(false);}
  }
  async function signOut(){setBusy(true);setError("");try{await onSignOut();}catch(reason){setError(reason instanceof Error?reason.message:"Unable to sign out. Try again.");}finally{setBusy(false);}}
  return <main className="mews-login"><title>Sign in · Mews</title><div className="mews-login-wrap">
    <a className="mews-login-brand" href="#login" aria-label="Mangrove Mews sign in"><span><PawPrint size={25}/></span><b>Mangrove <em>Mews</em></b></a>
    <p className="eyebrow">South Florida · rescue workspace</p><h1>Sign in to Mews</h1><p className="mews-login-intro">One shared picture of every colony. Sign in to review reports, coordinate care, and help the team act sooner.</p>
    <section className="mews-login-card" aria-label="Team sign-in">
      {(error||notice)&&<p className="mews-login-error" role={error?"alert":"status"}>{error||notice}</p>}
      {checking?<p role="status">Checking your team session…</p>:user?<>
        <div className="mews-login-account"><ShieldCheck size={23}/><div><h2>Welcome back</h2><p>{user.email}</p><span>{user.role==="admin"?"Administrator":user.role} · signed in</span></div></div>
        <button className="primary-button" onClick={onContinue} disabled={busy}>Continue to workspace <ArrowRight size={17}/></button>
        <button className="secondary-button" onClick={()=>void signOut()} disabled={busy}><LogOut size={16}/>{busy?"Signing out…":"Sign out and start again"}</button>
      </>:<>
        <div className="mews-login-account"><ShieldCheck size={23}/><div><h2>Your rescue account</h2><p>Use the email and password provided by your administrator.</p></div></div>
        <form onSubmit={signIn}>
          <label htmlFor="mews-login-email">Email</label><input id="mews-login-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={event=>setEmail(event.target.value)} required disabled={busy} autoFocus/>
          <label htmlFor="mews-login-password">Password</label><div className="mews-login-password"><input id="mews-login-password" type={showPassword?"text":"password"} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required disabled={busy}/><button type="button" aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          <button className="primary-button" type="submit" disabled={busy}>{busy?"Signing in…":"Sign in"}<ArrowRight size={17}/></button>
        </form>
        {localDemo&&<aside className="mews-login-demo"><div><ShieldCheck size={18}/><b>Local admin demo</b><span>Administrator</span></div><p>Explore the complete fictional rescue workflow.</p><button className="secondary-button" type="button" disabled={busy} onClick={()=>{setEmail("admin@mangrovemews.demo");setPassword("SyntheticMiami2026!");setError("");}}>Use admin demo account</button><details><summary>View local demo credentials</summary><p>Email: <code>admin@mangrovemews.demo</code><br/>Password: <code>SyntheticMiami2026!</code></p></details></aside>}
      </>}
    </section>
    {!user&&<button type="button" className="mews-login-public" onClick={onPublicMap} disabled={busy||checking}><MapPin size={16}/>Explore the public map</button>}
    <p className="mews-login-footer">Fictional cats and reports for the hackathon demo.<br/>Team records and precise planning views require an authorized session.</p>
  </div></main>;
}
