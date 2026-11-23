import { Banknote, Bitcoin, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";

const methods = [
  { name: "Saldo iion pay", icon: Wallet },
  { name: "Nequi", icon: Smartphone },
  { name: "Bre-B", icon: Smartphone },
  { name: "Bancolombia", icon: Landmark },
  { name: "PSE", icon: Landmark },
  { name: "Cripto", icon: Bitcoin },
  { name: "Tarjeta", icon: CreditCard },
];

export function IionPaymentMethods() {
  return <section aria-labelledby="iion-methods-title" className="rounded-2xl border border-hair bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2"><Banknote size={21} className="text-copper" aria-hidden="true" /><h2 id="iion-methods-title" className="font-display text-lg font-semibold text-graphite">Elige cómo pagar</h2></div>
    <p className="mt-2 text-sm leading-relaxed text-muted">Al abrir iion pay podrás elegir el medio disponible para tu cobro:</p>
    <ul className="mt-4 grid grid-cols-2 gap-2">
      {methods.map(({ name, icon: Icon }) => <li key={name} className="flex min-h-12 items-center gap-2 rounded-xl border border-hair bg-[#FAFAFB] px-3 text-sm font-medium text-graphite">
        <Icon size={18} strokeWidth={1.8} className="shrink-0 text-copper" aria-hidden="true" /><span>{name}</span>
      </li>)}
    </ul>
    <p className="mt-3 text-xs leading-relaxed text-muted">La selección y la disponibilidad final aparecen en la pasarela de iion pay. Wired no recibe tus claves ni datos bancarios.</p>
  </section>;
}
