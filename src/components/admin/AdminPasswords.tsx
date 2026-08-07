"use client";

import { useEffect, useState, type FormEvent } from "react";

export function AdminPasswords() {
  const [adminPassword, setAdminPassword] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/auth/passwords", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las contraseñas");
        return res.json() as Promise<{
          adminPassword: string;
          memberPassword: string;
        }>;
      })
      .then((data) => {
        setAdminPassword(data.adminPassword);
        setMemberPassword(data.memberPassword);
      })
      .catch(() => setError("No se pudieron cargar las contraseñas"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    const res = await fetch("/api/auth/passwords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword, memberPassword }),
    });

    setSaving(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "No se pudieron guardar");
      return;
    }

    const data = (await res.json()) as {
      adminPassword: string;
      memberPassword: string;
    };
    setAdminPassword(data.adminPassword);
    setMemberPassword(data.memberPassword);
    setStatus("Contraseñas actualizadas");
    window.setTimeout(() => setStatus(""), 2500);
  }

  if (loading) {
    return (
      <section className="mt-10 border border-[color:var(--line)] bg-white p-5">
        <p className="text-sm text-[color:var(--muted)]">Cargando contraseñas...</p>
      </section>
    );
  }

  return (
    <section className="mt-10 border border-[color:var(--line)] bg-white p-5 md:p-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--ink)]">
        Contraseñas de acceso
      </h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Son compartidas por rol. No se crean claves por integrante: solo estas dos.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
            Administrador
          </span>
          <input
            type="text"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            autoComplete="off"
          />
          <span className="text-xs text-[color:var(--muted)]">
            Acceso a sitio, tareas y contabilidad
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
            Equipo
          </span>
          <input
            type="text"
            value={memberPassword}
            onChange={(e) => setMemberPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            autoComplete="off"
          />
          <span className="text-xs text-[color:var(--muted)]">
            Acceso a sitio y seguimiento de tareas
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Actualizar contraseñas"}
          </button>
          {status && <p className="text-sm text-[color:var(--accent)]">{status}</p>}
          {error && <p className="text-sm text-[color:var(--accent)]">{error}</p>}
        </div>
      </form>
    </section>
  );
}
