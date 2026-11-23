import { Banknote } from "lucide-react";

const methods = [
  { id: "iion", name: "Saldo iion pay", note: "Paga con tu saldo" },
  { id: "nequi", name: "Nequi", note: "Aprueba desde la app" },
  { id: "breb", name: "Bre-B", note: "Transferencia inmediata" },
  { id: "bancolombia", name: "Bancolombia", note: "Paga desde tu cuenta" },
  { id: "pse", name: "PSE", note: "Débito desde tu banco" },
  { id: "cards", name: "Tarjeta", note: "Crédito o débito" },
  { id: "crypto", name: "Cripto", note: "Pago con criptomonedas" },
];

function PaymentBrand({ id }: { id: string }) {
  if (id === "iion") return <span className="text-[24px] font-extrabold tracking-[-.08em] text-[#5063A0]">iion</span>;
  if (id === "nequi") return <span className="relative text-[29px] font-black leading-none tracking-[-.12em] text-[#240021]"><span className="absolute -left-1 top-0 h-2 w-2 rounded-[2px] bg-[#E6007E]" />N</span>;
  if (id === "breb") return <span className="rounded bg-[#2D075F] px-1.5 py-1 text-[15px] font-black tracking-[-.06em] text-[#59F0B1]">Bre-B</span>;
  if (id === "bancolombia") return <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#292929"/><path d="M13 17.5 33 12l2 6.2-20 5.4zM13 26.2l20-5.4 2 6.2-20 5.4zM15 35l20-5.4-2 6.2-16 4.3z" fill="white"/></svg>;
  if (id === "pse") return <svg viewBox="0 0 52 52" className="h-11 w-11" aria-hidden="true"><circle cx="26" cy="26" r="23" fill="#00549F" stroke="#F5A800" strokeWidth="3"/><text x="26" y="31" textAnchor="middle" fontSize="17" fontStyle="italic" fontWeight="700" fill="white">pse</text></svg>;
  if (id === "cards") return <span className="flex items-center gap-1"><span className="text-[13px] font-black italic tracking-[-.08em] text-[#17357E]">VISA</span><span className="relative h-6 w-9"><span className="absolute left-0 top-0 h-6 w-6 rounded-full bg-[#EB001B]"/><span className="absolute right-0 top-0 h-6 w-6 rounded-full bg-[#F79E1B] opacity-90"/></span></span>;
  return <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7931A] text-[25px] font-black text-white">₿</span>;
}

export function IionPaymentMethods() {
  return <section aria-labelledby="iion-methods-title" className="rounded-2xl border border-hair bg-white p-4 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-copper"><Banknote size={22} aria-hidden="true" /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[.12em] text-copper">Varias formas de pago</p>
        <h2 id="iion-methods-title" className="mt-1 font-display text-xl font-bold text-graphite sm:text-2xl">Paga como prefieras</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">Escoge el medio que te quede más fácil al continuar al pago seguro.</p>
      </div>
    </div>
    <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {methods.map(({ id, name, note }) => <li key={name} className="flex min-h-[92px] items-center gap-3 rounded-xl border border-hair bg-[#FAFAFB] p-3 sm:p-4">
        <span aria-hidden="true" className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border border-hair bg-white shadow-sm"><PaymentBrand id={id} /></span>
        <span className="min-w-0"><strong className="block text-sm font-bold text-graphite sm:text-base">{name}</strong><span className="mt-0.5 block text-xs leading-snug text-muted">{note}</span></span>
      </li>)}
    </ul>
    <p className="mt-4 text-xs leading-relaxed text-muted">La disponibilidad final de cada opción se confirma en la pasarela de iion pay. Wired no recibe tus claves ni datos bancarios.</p>
  </section>;
}
