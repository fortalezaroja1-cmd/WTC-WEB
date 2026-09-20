"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  Plug,
  QrCode,
  RefreshCw,
  Unplug,
  UserRound,
  Bot,
} from "lucide-react";

type Connection = {
  id: string;
  channel: "WHATSAPP" | "MESSENGER" | "INSTAGRAM";
  externalAccountId: string;
  externalParentId?: string | null;
  accountName?: string | null;
  username?: string | null;
  status: string;
  metadata?: Record<string, any>;
};

type StatusPayload = {
  ok: boolean;
  env: any;
  connections: Connection[];
};

export default function IntegracionesPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const waCodeRef = useRef<string | null>(null);
  const waSessionRef = useRef<any>(null);
  const waCompletingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/integrations/meta/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar Integraciones");
      setStatus(data);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar Integraciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const queryError = params.get("error");
    const detail = params.get("detail");
    if (connected) setMessage(`${connected === "facebook" ? "Facebook / Messenger" : "Instagram"} conectado correctamente.`);
    if (queryError) setError(detail || `No se pudo completar ${queryError.replaceAll("_", " ")}.`);
    if (connected || queryError) window.history.replaceState({}, "", "/admin/integraciones");
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!/facebook\.com$/i.test(new URL(event.origin).hostname)) return;
      let data: any = event.data;
      try { if (typeof data === "string") data = JSON.parse(data); } catch { return; }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data?.event === "FINISH") {
        waSessionRef.current = data?.data || null;
        completeWhatsAppIfReady();
      } else if (data?.event === "CANCEL") {
        setBusy("");
        setError("El proceso de WhatsApp fue cancelado antes de terminar.");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const loadFacebookSdk = async () => {
    if ((window as any).FB) return;
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        setTimeout(() => (window as any).FB ? resolve() : reject(new Error("No cargó el SDK de Meta")), 5000);
        return;
      }
      (window as any).fbAsyncInit = () => resolve();
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/es_LA/sdk.js";
      script.onerror = () => reject(new Error("No se pudo cargar el SDK de Meta"));
      document.body.appendChild(script);
    });
    const appId = status?.env?.whatsapp?.appId;
    if (!(window as any).FB || !appId) throw new Error("SDK o App ID de Meta no disponible");
    (window as any).FB.init({ appId, autoLogAppEvents: true, xfbml: true, version: status?.env?.graphVersion || "v26.0" });
  };

  const completeWhatsAppIfReady = async () => {
    if (waCompletingRef.current || !waCodeRef.current || !waSessionRef.current) return;
    waCompletingRef.current = true;
    try {
      const session = waSessionRef.current;
      const res = await fetch("/api/admin/integrations/meta/whatsapp/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: waCodeRef.current,
          wabaId: session?.waba_id,
          phoneNumberId: session?.phone_number_id,
          businessId: session?.business_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo completar WhatsApp");
      setMessage(`WhatsApp conectado${data?.connection?.displayPhoneNumber ? `: ${data.connection.displayPhoneNumber}` : ""}.`);
      setError("");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo completar WhatsApp");
    } finally {
      waCompletingRef.current = false;
      waCodeRef.current = null;
      waSessionRef.current = null;
      setBusy("");
    }
  };

  const connectWhatsApp = async () => {
    if (!status?.env?.whatsapp?.ready) return;
    setBusy("WHATSAPP"); setError(""); setMessage("");
    try {
      await loadFacebookSdk();
      const FB = (window as any).FB;
      FB.login((response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setBusy("");
          setError("Meta no devolvió el código de WhatsApp. Completa el proceso y acepta los permisos.");
          return;
        }
        waCodeRef.current = code;
        completeWhatsAppIfReady();
      }, {
        config_id: status.env.whatsapp.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      });
    } catch (e: any) {
      setBusy("");
      setError(e?.message || "No se pudo abrir WhatsApp");
    }
  };

  const disconnect = async (id: string) => {
    setBusy(id); setError("");
    try {
      const res = await fetch("/api/admin/integrations/meta/disconnect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo desconectar");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo desconectar");
    } finally { setBusy(""); }
  };

  const active = (channel: Connection["channel"]) => (status?.connections || []).filter((c) => c.channel === channel && c.status === "CONNECTED");

  return <div className="max-w-[1100px]">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2"><Plug size={22} className="text-copper"/><h1 className="font-display text-2xl font-bold">Integraciones</h1></div>
        <p className="text-sm text-muted mt-1">Conecta tus canales como en un CRM comercial: inicia sesión, autoriza y listo.</p>
      </div>
      <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 border border-hair rounded-lg px-3 py-2 text-xs font-semibold bg-white"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Actualizar estado</button>
    </div>

    {message && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm flex gap-2"><CheckCircle2 size={17}/>{message}</div>}
    {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-alert px-4 py-3 text-sm flex gap-2"><AlertTriangle size={17}/><span>{error}</span></div>}

    <Link href="/admin/integraciones/ia" className="mb-5 block rounded-xl border border-copper/20 bg-[#FFF9F4] p-5 hover:border-copper transition-colors"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-white border border-hair flex items-center justify-center text-copper"><Bot size={22}/></div><div><div className="font-semibold">Inteligencia artificial</div><div className="text-xs text-muted mt-1">Conecta OpenAI, Anthropic o Gemini con API key y prueba cada modelo en un chat.</div></div></div><span className="text-xs font-semibold text-copper whitespace-nowrap">Configurar →</span></div></Link>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ChannelCard
        icon={<MessageCircle size={24}/>} name="WhatsApp" subtitle="WhatsApp Business + CRM"
        description="Abre el onboarding oficial de Meta. Si el número usa WhatsApp Business, Coexistence permite mantener la app y conectarlo al CRM. Meta mostrará la verificación/QR cuando corresponda."
        ready={Boolean(status?.env?.whatsapp?.ready)} missing={status?.env?.whatsapp?.missing || []}
        connections={active("WHATSAPP")} busy={busy === "WHATSAPP"} onConnect={connectWhatsApp} onDisconnect={disconnect}
        connectLabel="Conectar WhatsApp" extra={<div className="flex items-center gap-1.5 text-[11px] text-muted"><QrCode size={14}/>QR/código dentro del flujo oficial de Meta</div>}
      />

      <ChannelCard
        icon={<UserRound size={24}/>} name="Instagram" subtitle="Instagram Professional"
        description="Inicia sesión directamente con Instagram y autoriza mensajería. Funciona con cuentas profesionales de empresa o creador."
        ready={Boolean(status?.env?.instagram?.ready)} missing={status?.env?.instagram?.missing || []}
        connections={active("INSTAGRAM")} busy={busy === "INSTAGRAM"}
        onConnect={() => { setBusy("INSTAGRAM"); window.location.href = "/api/admin/integrations/meta/instagram/start"; }} onDisconnect={disconnect}
        connectLabel="Iniciar sesión con Instagram"
      />

      <ChannelCard
        icon={<MessageCircle size={24}/>} name="Facebook Messenger" subtitle="Páginas de Facebook"
        description="Inicia sesión con Facebook. Wired detecta las páginas administradas, activa la suscripción de mensajes y guarda cada página como canal."
        ready={Boolean(status?.env?.facebook?.ready)} missing={status?.env?.facebook?.missing || []}
        connections={active("MESSENGER")} busy={busy === "MESSENGER"}
        onConnect={() => { setBusy("MESSENGER"); window.location.href = "/api/admin/integrations/meta/facebook/start"; }} onDisconnect={disconnect}
        connectLabel="Continuar con Facebook"
      />
    </div>

    <div className="mt-5 bg-[#14181F] text-white rounded-xl p-5">
      <div className="font-semibold">Centro omnicanal</div>
      <p className="text-xs text-[#AAB2BD] mt-2 leading-relaxed">Las credenciales quedan cifradas en servidor. No se muestran access tokens en el navegador. El webhook base de Meta continúa en <span className="font-mono text-white">/api/meta/webhook</span>.</p>
      {loading && <div className="mt-3 inline-flex items-center gap-2 text-xs text-[#AAB2BD]"><LoaderCircle size={14} className="animate-spin"/>Comprobando configuración…</div>}
    </div>
  </div>;
}

function ChannelCard({ icon, name, subtitle, description, ready, missing, connections, busy, onConnect, onDisconnect, connectLabel, extra }:{
  icon: React.ReactNode; name:string; subtitle:string; description:string; ready:boolean; missing:string[]; connections:Connection[]; busy:boolean;
  onConnect:()=>void; onDisconnect:(id:string)=>void; connectLabel:string; extra?:React.ReactNode;
}) {
  return <section className="bg-white border border-hair rounded-xl p-5 flex flex-col min-h-[390px]">
    <div className="flex items-start justify-between gap-3"><div className="h-11 w-11 rounded-xl bg-paper flex items-center justify-center text-copper">{icon}</div><span className={`text-[10px] font-semibold rounded-full px-2.5 py-1 ${connections.length ? "bg-green-50 text-green" : ready ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{connections.length ? "Conectado" : ready ? "Listo para conectar" : "Falta configurar"}</span></div>
    <h2 className="font-display text-lg font-bold mt-4">{name}</h2><div className="text-[11px] text-muted mt-0.5">{subtitle}</div>
    <p className="text-xs text-muted mt-3 leading-relaxed">{description}</p>
    {extra && <div className="mt-3">{extra}</div>}

    <div className="mt-4 space-y-2 flex-1">
      {connections.map((connection) => <div key={connection.id} className="rounded-lg border border-hair bg-[#FAFAFA] p-3 flex items-center justify-between gap-2">
        <div className="min-w-0"><div className="text-xs font-semibold truncate">{connection.accountName || connection.username || connection.externalAccountId}</div><div className="text-[10px] text-muted truncate">{connection.username || connection.externalAccountId}</div></div>
        <button onClick={()=>onDisconnect(connection.id)} disabled={busy} className="h-8 w-8 rounded-lg border border-hair flex items-center justify-center text-muted hover:text-alert" aria-label="Desconectar"><Unplug size={14}/></button>
      </div>)}
      {!ready && missing.length > 0 && <div className="rounded-lg bg-amber-50 border border-amber-100 p-3"><div className="text-[10px] font-semibold text-amber-800 mb-1">Configuración pendiente</div>{missing.map((item)=><div key={item} className="font-mono text-[10px] text-amber-800">{item}</div>)}</div>}
    </div>

    <button onClick={onConnect} disabled={!ready || busy} className="mt-4 w-full rounded-lg bg-graphite text-white py-2.5 px-3 text-xs font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2">
      {busy ? <LoaderCircle size={15} className="animate-spin"/> : null}{connections.length ? `Conectar otra cuenta` : connectLabel}
    </button>
  </section>;
}
