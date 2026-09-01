"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";
import { AdminOpsPanel } from "@/components/admin/AdminOpsPanel";
import { AdminPasswordsModal } from "@/components/admin/AdminPasswords";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import type { AdminModule, SessionRole } from "@/lib/auth/session";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.8 7.8 0 00.1-2l2-1.2-2-3.4-2.3.7a7.6 7.6 0 00-1.7-1L15 3.5h-4l-.5 2.6a7.6 7.6 0 00-1.7 1L6.5 6.4l-2 3.4 2 1.2a7.8 7.8 0 000 2l-2 1.2 2 3.4 2.3-.7a7.6 7.6 0 001.7 1l.5 2.6h4l.5-2.6a7.6 7.6 0 001.7-1l2.3.7 2-3.4-2-1.2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function BillingIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <rect x="12" y="10" width="40" height="48" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M20 22h24M20 30h24M20 38h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M40 42l6 6 10-12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkshopsIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <circle cx="32" cy="36" r="16" stroke="currentColor" strokeWidth="3" />
      <path
        d="M32 12v8M22 18c4 2 6 4 10 4s6-2 10-4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M24 34c2 4 5 6 8 6s6-2 8-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <rect x="10" y="14" width="44" height="40" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M10 26h44" stroke="currentColor" strokeWidth="3" />
      <path d="M22 10v10M42 10v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="18" y="32" width="8" height="8" fill="currentColor" />
      <rect x="30" y="32" width="8" height="8" fill="currentColor" opacity="0.45" />
      <rect x="42" y="32" width="8" height="8" fill="currentColor" opacity="0.45" />
      <rect x="18" y="44" width="8" height="6" fill="currentColor" opacity="0.45" />
      <rect x="30" y="44" width="8" height="6" fill="currentColor" />
    </svg>
  );
}

function FollowUpIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true" fill="none">
      <rect x="12" y="10" width="40" height="44" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M22 24h20M22 34h20M22 44h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="44" cy="44" r="10" fill="white" stroke="currentColor" strokeWidth="3" />
      <path
        d="M40 44l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const { t } = useAdminLanguage();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [passwordsOpen, setPasswordsOpen] = useState(false);

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

  const modules = me?.modules || [
    "sitio",
    "talleres",
    "cronograma",
    "seguimiento",
    "tareas",
  ];
  const canAccounting = modules.includes("contabilidad");
  const canBilling = modules.includes("cuentas-cobro");
  const canTalleres =
    modules.includes("talleres") || modules.includes("sitio");
  // Visible con el módulo propio o con talleres/sitio (mismo equipo operativo).
  const canCronograma =
    modules.includes("cronograma") ||
    modules.includes("talleres") ||
    modules.includes("sitio");
  const canSeguimiento =
    modules.includes("seguimiento") ||
    modules.includes("cronograma") ||
    modules.includes("talleres") ||
    modules.includes("sitio");
  const roleLabel = me?.role === "admin" ? t.common.administrator : t.common.team;
  const isAdmin = me?.role === "admin";

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="border-b border-[color:var(--line)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--accent)]">
              Inspiralab
            </p>
            <p className="text-sm text-[color:var(--muted)]">
              {t.common.adminPanel}
              {me?.name ? ` · ${me.name}` : ""} · {roleLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AdminLanguageSwitcher />
            <Link
              href="/"
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[color:var(--ink)]"
            >
              {t.common.viewSite}
            </Link>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setPasswordsOpen(true)}
                className="inline-flex items-center justify-center border border-[color:var(--line)] px-2.5 py-2 text-[color:var(--ink)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                aria-label={t.common.configurePasswords}
                title={t.common.configurePasswords}
              >
                <SettingsIcon />
              </button>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.common.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 pb-16 md:px-8 md:py-16">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[color:var(--ink)] md:text-4xl">
          {t.dashboard.whatToDo}
        </h1>
        <p className="mt-3 max-w-xl text-base text-[color:var(--muted)]">
          {canAccounting ? t.dashboard.fullAccess : t.dashboard.limitedAccess}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                  {t.dashboard.editSite}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.editSiteDesc}
                </p>
              </div>
            </Link>
          )}

          {canTalleres && (
            <Link
              href="/admin/talleres"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <WorkshopsIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  {t.dashboard.workshops}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.workshopsDesc}
                </p>
              </div>
            </Link>
          )}

          {canCronograma && (
            <Link
              href="/admin/cronograma"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <ScheduleIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  {t.dashboard.schedule}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.scheduleDesc}
                </p>
              </div>
            </Link>
          )}

          {canSeguimiento && (
            <Link
              href="/admin/seguimiento-talleres"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <FollowUpIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  {t.dashboard.followUp}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.followUpDesc}
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
                  {t.dashboard.tasks}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.tasksDesc}
                </p>
              </div>
            </Link>
          )}

          {canBilling && !isAdmin && (
            <Link
              href="/admin/cuentas-cobro"
              className="group flex flex-col items-start gap-5 border border-[color:var(--line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-[0_18px_40px_-28px_rgba(224,13,69,0.45)]"
            >
              <span className="text-[color:var(--accent)] transition-transform duration-300 group-hover:scale-105">
                <BillingIcon />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
                  {t.dashboard.billing}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.billingDesc}
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
                  {t.dashboard.accounting}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t.dashboard.accountingDesc}
                </p>
              </div>
            </Link>
          )}
        </div>

        <AdminOpsPanel canAccounting={canAccounting} />
      </main>
      <AdminFooter />
      {isAdmin && (
        <AdminPasswordsModal open={passwordsOpen} onClose={() => setPasswordsOpen(false)} />
      )}
    </div>
  );
}
