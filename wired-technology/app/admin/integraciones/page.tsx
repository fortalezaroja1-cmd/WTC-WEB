"use client";
import { useEffect, useState } from "react";

export default function IntegracionesPage() {
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [ordersOk, setOrdersOk] = useState<boolean | null>(null);
  useEffect(()=>{
    fetch("/api/admin/crm/leads", { cache:"no-store" }).then(async r=>{ if(!r.ok) throw new Error(); const d=await r.json(); setLeadCount(Array.isArray(d)?d.length:0); }).catch(()=>setLeadCount(-1));
    fetch("/api/admin/orders", { cache:"no-store" }).then(r=>setOrdersOk(r.ok)).catch(()=>setOrdersOk(false));
  },[]);
  const cards = [
    { name:"Tienda web", state:ordersOk===null?"CHECKING":ordersOk?"OK":"ERROR", detail:"Pedidos web conectados al panel y al CRM." },
    { name:"Meta Webhook / WhatsApp", state:leadCount===null?"CHECKING":leadCount>=0?"READY":"ERROR", detail:leadCount && leadCount>0 ? `${leadCount} leads recibidos por el CRM.` : "Endpoint configurado en /api/meta/webhook. Aún sin mensajes almacenados o pendiente de tráfico real." },
    { name:"Instagram", state:"PENDING", detail:"Preparado para integrarse al inbox cuando Meta habilite y entregue los eventos correspondientes." },
    { name:"Messenger", state:"PENDING", detail:"Pendiente de conexión al mismo centro de conversaciones." },
    { name:"Correo", state:"PENDING", detail:"Sin proveedor de correo conectado al CRM." },
  ];
  return <div className="max-w-[1000px]">
    <div className="mb-5"><h1 className="font-display text-2xl font-bold">Integraciones</h1><p className="text-sm text-muted mt-1">Estado técnico de los canales que alimentan Wired Technology.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map(c=><div key={c.name} className="bg-white border border-hair rounded-xl p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{c.name}</h2><Badge state={c.state}/></div>
        <p className="text-xs text-muted mt-3 leading-relaxed">{c.detail}</p>
      </div>)}
    </div>
    <div className="mt-5 bg-[#14181F] text-white rounded-xl p-5"><div className="font-semibold">Webhook actual</div><div className="font-mono text-xs text-[#C4CCD6] mt-2 break-all">/api/meta/webhook</div><p className="text-xs text-[#8D96A3] mt-2">No se muestran tokens ni credenciales en esta pantalla.</p></div>
  </div>;
}
function Badge({state}:{state:string}) {
  const map:any = { OK:["Conectado","bg-green-50 text-green"], READY:["Listo","bg-green-50 text-green"], PENDING:["Pendiente","bg-amber-50 text-amber-700"], ERROR:["Error","bg-red-50 text-alert"], CHECKING:["Revisando","bg-paper text-muted"] };
  const [label,cls]=map[state]||map.PENDING;
  return <span className={`text-[10px] font-semibold rounded-full px-2.5 py-1 ${cls}`}>{label}</span>;
}
