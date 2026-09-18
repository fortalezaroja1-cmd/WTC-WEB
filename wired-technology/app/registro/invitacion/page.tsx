"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function InvitationForm(){
 const params=useSearchParams(); const token=params.get("token")||"";
 const [info,setInfo]=useState<any>(null),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[error,setError]=useState(""),[done,setDone]=useState(false),[saving,setSaving]=useState(false);
 useEffect(()=>{ if(!token){setError("Invitación inválida");return;} fetch("/api/invitations/accept?token="+encodeURIComponent(token),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setInfo(d)}).catch(e=>setError(e.message));},[token]);
 async function submit(){setError("");if(password!==confirm)return setError("Las contraseñas no coinciden");setSaving(true);try{const r=await fetch("/api/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);setDone(true)}catch(e:any){setError(e.message)}finally{setSaving(false)}}
 return <main className="min-h-screen bg-paper flex items-center justify-center p-5"><div className="w-full max-w-md bg-white border border-hair rounded-2xl p-6 shadow-sm">
  <div className="text-xs font-bold tracking-[.18em] text-copper mb-2">WIRED TECHNOLOGY</div><h1 className="text-2xl font-bold mb-2">Crear acceso</h1>
  {done?<><p className="text-sm text-muted mb-5">Tu cuenta quedó creada. Ya puedes entrar al CRM.</p><a href="/admin/login" className="block text-center bg-graphite text-white rounded-lg py-3 font-semibold">Iniciar sesión</a></>:
  <>{info&&<p className="text-sm text-muted mb-5">Hola <b>{info.name}</b>. Fuiste invitado con el correo <b>{info.email}</b>.</p>}
  {error&&<div className="bg-red-50 text-alert rounded-lg p-3 text-sm mb-4">{error}</div>}
  {info&&<div className="space-y-3"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Crea una contraseña" className="w-full border border-hair rounded-lg px-3 py-3"/><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repite la contraseña" className="w-full border border-hair rounded-lg px-3 py-3"/><button onClick={submit} disabled={saving} className="w-full bg-copper text-white rounded-lg py-3 font-semibold disabled:opacity-50">{saving?"Creando...":"Crear mi cuenta"}</button></div>}</>}
 </div></main>
}

export default function InvitationPage(){ return <Suspense fallback={<main className="min-h-screen bg-paper"/>}><InvitationForm/></Suspense>; }
