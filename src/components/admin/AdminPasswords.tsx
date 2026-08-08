"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/admin/AdminToast";

export function AdminPasswordsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [adminPassword, setAdminPassword] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setStatus("");
    void fetch("/api/auth/passwords", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las contraseñas");
        return res.json() as Promise<{
          adminPassword: string;
          memberPassword: string;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setAdminPassword(data.adminPassword);
        setMemberPassword(data.memberPassword);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudieron cargar las contraseñas");
          toast.error("No se pudieron cargar las contraseñas");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
      const msg = payload?.error || "No se pudieron guardar";
      setError(msg);
      toast.error(msg);
      return;
    }

    const data = (await res.json()) as {
      adminPassword: string;
      memberPassword: string;
    };
    setAdminPassword(data.adminPassword);
    setMemberPassword(data.memberPassword);
    setStatus("Contraseñas actualizadas");
    toast.success("Contraseñas actualizadas");
    window.setTimeout(() => setStatus(""), 2500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="passwords-title"
        className="w-full max-w-lg border border-[color:var(--line)] bg-white p-5 shadow-xl md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="passwords-title"
              className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]"
            >
              Configurar contraseñas
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Actualiza las claves de administración y de actividades (equipo).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2.5 py-1 text-sm font-semibold"
          >
            Cerrar
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">Cargando...</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                Administración
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
                Sitio, tareas y contabilidad
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                Actividades / equipo
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
              <span className="text-xs text-[color:var(--muted)]">Sitio y seguimiento de tareas</span>
            </label>

            <div className="flex flex-wrap items-center gap-3 pt-1">
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
        )}
      </div>
    </div>
  );
}
