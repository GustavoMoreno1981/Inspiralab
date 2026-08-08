"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/** visible=true → ojo abierto (texto visible); visible=false → ojo tachado (asteriscos). */
function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.5 10.6a2.5 2.5 0 003.5 3.5M9.9 5.1A10.5 10.5 0 0112 5c5 0 9.3 3.1 11 7-.5 1.2-1.3 2.3-2.2 3.2M6.1 6.1C4.5 7.3 3.3 8.9 2.5 10.7c1.7 3.9 6 7 9.5 7 1.1 0 2.2-.2 3.2-.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Contraseña incorrecta");
      return;
    }

    const next = searchParams.get("next") || "/admin";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-5 py-16">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--accent)]"
      >
        Inspiralab
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)]">
        Inicio de sesión
      </h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Ingresa solo con la contraseña de tu rol (administrador o equipo).
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm text-[color:var(--muted)]">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[color:var(--line)] bg-white px-4 py-3 pr-12 outline-none focus:border-[color:var(--accent)]"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className={`absolute top-1/2 right-3 -translate-y-1/2 ${
                showPassword
                  ? "text-[color:var(--accent)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--ink)]"
              }`}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-[color:var(--accent)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[color:var(--accent)] px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
