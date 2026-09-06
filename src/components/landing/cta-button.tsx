import Link from "next/link";
import type { ReactNode } from "react";

interface CtaButtonProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline";
}

/** Botón de entrada al chat. Border radius y color según docs/design-system.md. */
export function CtaButton({ href, children, variant = "primary" }: CtaButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold transition-colors";
  const estilos =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent/90"
      : "border border-primary text-primary hover:bg-primary/5";

  return (
    <Link href={href} className={`${base} ${estilos}`}>
      {children}
    </Link>
  );
}
