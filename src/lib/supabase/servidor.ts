import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

/**
 * Cliente Supabase para el servidor (panel del consultor), con la sesión del usuario leída de las
 * cookies. Respeta RLS: solo devuelve lo que `es_consultor()` permite.
 *
 * Escribir cookies desde un Server Component no está permitido en Next 16; el `set` va en
 * try/catch. El refresco del token de acceso se hace en el login (cliente de navegador); si la
 * sesión caduca (~1 h), el consultor vuelve a iniciar sesión. Suficiente para una herramienta
 * interna de una sola persona.
 */
export async function clienteServidor() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            /* Server Component: no se pueden escribir cookies aquí */
          }
        },
      },
    },
  );
}

export interface SesionConsultor {
  userId: string;
  email: string | null;
  nombre: string;
}

/**
 * Exige sesión válida + fila en `consultores`. Si falta cualquiera de las dos, redirige al login
 * sin exponer nada (M-11).
 */
export async function requerirConsultor(): Promise<SesionConsultor> {
  const supabase = await clienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/panel/login");

  const { data: fila } = await supabase
    .from("consultores")
    .select("nombre")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!fila) redirect("/panel/login?motivo=no-autorizado");

  return { userId: auth.user.id, email: auth.user.email ?? null, nombre: fila.nombre as string };
}
