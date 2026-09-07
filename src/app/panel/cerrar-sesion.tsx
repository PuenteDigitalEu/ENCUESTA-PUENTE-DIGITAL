"use client";

import { useRouter } from "next/navigation";

import { clienteNavegador } from "@/lib/supabase/navegador";

export function CerrarSesion() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await clienteNavegador().auth.signOut();
        router.replace("/panel/login");
        router.refresh();
      }}
      className="rounded-lg border border-surface px-3 py-1 font-medium text-text-primary transition-colors hover:bg-surface"
    >
      Salir
    </button>
  );
}
