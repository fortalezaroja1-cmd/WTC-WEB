import { Banknote, Bitcoin, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";

const methods = [
  { name: "Saldo iion pay", note: "Paga con tu saldo", icon: Wallet, tone: "bg-indigo-50 text-indigo-700" },
  { name: "Nequi", note: "Aprueba desde la app", icon: Smartphone, tone: "bg-pink-50 text-pink-700" },
  { name: "Bre-B", note: "Transferencia inmediata", icon: Smartphone, tone: "bg-violet-50 text-violet-700" },
  { name: "Bancolombia", note: "Paga desde tu cuenta", icon: Landmark, tone: "bg-yellow-50 text-yellow-800" },
  { name: "PSE", note: "Débito desde tu banco", icon: Landmark, tone: "bg-blue-50 text-blue-700" },
  { name: "Tarjeta", note: "Crédito o débito", icon: CreditCard, tone: "bg-orange-50 text-orange-700" },
  { name: "Cripto", note: "Pago con criptomonedas", icon: Bitcoin, tone: "bg-amber-50 text-amber-700" },
];

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
      {methods.map(({ name, note, icon: Icon, tone }) => <li key={name} className="flex min-h-[86px] items-center gap-3 rounded-xl border border-hair bg-[#FAFAFB] p-3 sm:p-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={20} strokeWidth={1.9} aria-hidden="true" /></span>
        <span className="min-w-0"><strong className="block text-sm font-bold text-graphite sm:text-base">{name}</strong><span className="mt-0.5 block text-xs leading-snug text-muted">{note}</span></span>
      </li>)}
    </ul>
    <p className="mt-4 text-xs leading-relaxed text-muted">La disponibilidad final de cada opción se confirma en la pasarela de iion pay. Wired no recibe tus claves ni datos bancarios.</p>
  </section>;
}
