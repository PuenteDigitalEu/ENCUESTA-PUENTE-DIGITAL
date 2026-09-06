import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

// Tipografía de docs/design-system.md: Sora para titulares, Inter para cuerpo y chat.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Diagnóstico financiero",
  description:
    "Landing con agente de diagnóstico financiero para captación de clientes de una asesoría financiera.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text-primary font-body">
        {children}
      </body>
    </html>
  );
}
