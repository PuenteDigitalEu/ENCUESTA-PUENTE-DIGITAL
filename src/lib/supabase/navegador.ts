"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para el navegador (login del consultor en el panel). Usa la clave pública
 * (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) y guarda la sesión en cookies, para que el servidor pueda
 * leerla en los Server Components del panel.
 */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
