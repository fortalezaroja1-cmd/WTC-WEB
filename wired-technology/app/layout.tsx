import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wired Technology · Materiales eléctricos e iluminación",
  description: "Cables Centelsa, iluminación LED y accesorios Mercury. Envío a toda Colombia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
