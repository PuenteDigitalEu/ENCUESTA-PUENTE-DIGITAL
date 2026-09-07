"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { clienteNavegador } from "@/lib/supabase/navegador";

export function LoginForm({ motivo }: { motivo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    motivo === "no-autorizado" ? "Esta cuenta no tiene acceso al panel." : null,
  );
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = clienteNavegador();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError("Email o contraseña incorrectos.");
      setCargando(false);
      return;
    }
    router.replace("/panel");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="mx-auto mt-24 flex w-full max-w-[360px] flex-col gap-4 px-6">
      <h1 className="font-display text-2xl font-semibold text-text-primary">Panel · Puente Digital EU</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-surface px-3 py-2 text-[15px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-surface px-3 py-2 text-[15px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={cargando || !email || !password}
        className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors disabled:opacity-50"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
