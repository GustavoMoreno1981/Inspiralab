"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/admin/AdminToast";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";

export function AdminPasswordsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const [adminPassword, setAdminPassword] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [bitacoraUrl, setBitacoraUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPasswords, setSavingPasswords] = useState(false);
  const [savingBitacora, setSavingBitacora] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setStatus("");

    void Promise.all([
      fetch("/api/auth/passwords", { cache: "no-store" }).then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las contraseñas");
        return res.json() as Promise<{
          adminPassword: string;
          memberPassword: string;
        }>;
      }),
      fetch("/api/admin/settings", { cache: "no-store" }).then(async (res) => {
        if (!res.ok) return { bitacoraUrl: "" };
        return res.json() as Promise<{ bitacoraUrl?: string }>;
      }),
    ])
      .then(([passwords, settings]) => {
        if (cancelled) return;
        setAdminPassword(passwords.adminPassword);
        setMemberPassword(passwords.memberPassword);
        setBitacoraUrl(settings.bitacoraUrl || "");
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar la configuración");
          toast.error("No se pudo cargar la configuración");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  async function onSubmitPasswords(event: FormEvent) {
    event.preventDefault();
    setSavingPasswords(true);
    setError("");
    setStatus("");

    const res = await fetch("/api/auth/passwords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword, memberPassword }),
    });

    setSavingPasswords(false);

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

  async function onSubmitBitacora(event: FormEvent) {
    event.preventDefault();
    setSavingBitacora(true);
    setError("");
    setStatus("");

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bitacoraUrl }),
    });

    setSavingBitacora(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      const msg = payload?.error || "No se pudo guardar la URL";
      setError(msg);
      toast.error(msg);
      return;
    }

    const data = (await res.json()) as { bitacoraUrl?: string };
    setBitacoraUrl(data.bitacoraUrl || "");
    setStatus(t.common.bitacoraSaved);
    toast.success(t.common.bitacoraSaved);
    window.setTimeout(() => setStatus(""), 2500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="max-h-[90svh] w-full max-w-lg overflow-y-auto border border-[color:var(--line)] bg-white p-5 shadow-xl md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="settings-title"
              className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]"
            >
              {t.common.settingsTitle}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{t.common.settingsDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--line)] px-2.5 py-1 text-sm font-semibold"
          >
            {t.common.close}
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">{t.common.loading}</p>
        ) : (
          <div className="mt-5 space-y-8">
            <form onSubmit={(e) => void onSubmitBitacora(e)} className="space-y-4">
              <h3 className="text-sm font-bold text-[color:var(--ink)]">{t.common.bitacora}</h3>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                  {t.common.bitacoraUrl}
                </span>
                <input
                  type="url"
                  value={bitacoraUrl}
                  onChange={(e) => setBitacoraUrl(e.target.value)}
                  placeholder={t.common.bitacoraUrlPlaceholder}
                  className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                  autoComplete="off"
                />
                <span className="text-xs text-[color:var(--muted)]">{t.common.bitacoraUrlHint}</span>
              </label>
              <button
                type="submit"
                disabled={savingBitacora}
                className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingBitacora ? t.common.saving : t.common.save}
              </button>
            </form>

            <div className="border-t border-[color:var(--line)] pt-6">
              <form onSubmit={(e) => void onSubmitPasswords(e)} className="space-y-4">
                <h3 className="text-sm font-bold text-[color:var(--ink)]">
                  {t.common.configurePasswords}
                </h3>
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
                  <span className="text-xs text-[color:var(--muted)]">
                    Sitio y seguimiento de tareas
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={savingPasswords}
                  className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingPasswords ? t.common.saving : "Actualizar contraseñas"}
                </button>
              </form>
            </div>

            {(status || error) && (
              <div className="pt-1">
                {status && <p className="text-sm text-[color:var(--accent)]">{status}</p>}
                {error && <p className="text-sm text-[color:var(--accent)]">{error}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
