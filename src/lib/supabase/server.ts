import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente Supabase con la clave de servicio — solo para código de servidor (`app/api/`). Salta
 * todas las políticas RLS (ver `docs/data-model.md` → "Políticas de acceso"), por eso no debe
 * llegar nunca al navegador: la variable no lleva el prefijo `NEXT_PUBLIC_` a propósito.
 *
 * Instanciado una sola vez, igual que `clienteClaude()` — falla explícitamente si faltan las
 * variables, mejor un error claro en el log que una ruta que responde 500 sin decir por qué.
 */
export function clienteSupabase(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !claveServicio) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas. " +
          "Rellénalas en .env.local (ver .env.example).",
      );
    }
    cliente = createClient(url, claveServicio, { auth: { persistSession: false } });
  }
  return cliente;
}
