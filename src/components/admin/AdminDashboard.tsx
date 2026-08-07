"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminOpsPanel } from "@/components/admin/AdminOpsPanel";
import { AdminPasswords } from "@/components/admin/AdminPasswords";
import type { AdminModule, SessionRole } from "@/lib/auth/session";

function EditSiteIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <rect x="8" y="12" width="48" height="36" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M8 22h48" stroke="currentColor" strokeWidth="3" />
      <circle cx="14" cy="17" r="1.5" fill="currentColor" />
      <circle cx="20" cy="17" r="1.5" fill="currentColor" />
      <circle cx="26" cy="17" r="1.5" fill="currentColor" />
      <path
        d="M38 44l8.5-8.5a3 3 0 014.2 4.2L42.2 48.2 36 50l1.8-6z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <rect x="12" y="10" width="40" height="44" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M22 24h20M22 34h20M22 44h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 24l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccountingIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <rect x="10" y="14" width="44" height="36" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M18 28h28M18 36h18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="44" cy="40" r="8" stroke="currentColor" strokeWidth="3" />
      <path d="M44 36v8M41 39h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

type MeResponse = {
  authenticated: boolean;
  role?: SessionRole;
  name?: string | null;
  modules?: AdminModule[];
};

export function AdminDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: MeResponse) => setMe(data))
      .catch(() => setMe({ authenticated: false }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const modules = me?.modules || ["sitio", "tareas"];
  const canAccounting = modules.includes("contabilidad");
  const roleLabel = me?.role === "admin" ? "Administrador" : "Equipo";

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="border-b border-[color:var(--line)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--accent)]">
              Inspiralab
            </p>
            <p className="text-sm text-[color:var(--muted)]">
              Panel de administración
              {me?.name ? ` · ${me.name}` : ""} · {roleLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[color:var(--ink)]"
            >
              Ver sitio
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 pb-16 md:px-8 md:py-16">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)] md:text-4xl">
          ¿Qué quieres hacer?
        </h1>
        <p className="mt-3 max-w-xl text-base text-[color:var(--muted)]">
          {canAccounting
            ? "Tienes acceso completo a los módulos del panel."
            : "Tu acceso incluye editar el sitio y el seguimiento de tareas."}
        </p>

        <div
          className={`mt-10 grid gap-5 sm:grid-cols-2 ${
            canAccounting ? "lg:grid-cols-3" : ""
          }`}
        >
          {modules.includes("sitio") && (
            <Link
              href="/admin/sitio"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <EditSiteIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  Editar sitio web
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  Textos, talleres, galería, video del hero y más.
                </p>
              </div>
            </Link>
          )}

          {modules.includes("tareas") && (
            <Link
              href="/admin/tareas"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <TasksIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  Seguimiento de tareas
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  Equipo, estados, subtareas y barra de progreso.
                </p>
              </div>
            </Link>
          )}

          {canAccounting && (
            <Link
              href="/admin/contabilidad"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <AccountingIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  Contabilidad
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  Ingresos, egresos y control financiero.
                </p>
              </div>
            </Link>
          )}
        </div>

        {me?.role === "admin" && <AdminPasswords />}

        <AdminOpsPanel canAccounting={canAccounting} />
      </main>
      <AdminFooter />
    </div>
  );
}
