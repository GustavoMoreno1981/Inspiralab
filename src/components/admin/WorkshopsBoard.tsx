"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";
import { useAdminLanguage } from "@/lib/i18n/AdminLanguageContext";
import { UnsavedChangesReminder } from "@/components/admin/UnsavedChangesReminder";
import { UnsavedLeaveDialog } from "@/components/admin/UnsavedLeaveDialog";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
import { useToast } from "@/components/admin/AdminToast";
import {
  WorkshopsAssistant,
  type WorkshopAssistantDraft,
} from "@/components/admin/WorkshopsAssistant";
import type { Dictionary, Locale, SiteContent } from "@/lib/i18n/dictionaries";
import { createWorkshopId } from "@/lib/media/youtube";

const FLOWER_LABELS: Record<Locale, string[]> = {
  es: ["Flor del Amor", "Flor de la Fe", "Flor de la Esperanza"],
  en: ["Flower of Love", "Flower of Faith", "Flower of Hope"],
};

const LEVEL_OPTIONS = [
  { value: 1 as const, label: "Nivel 1 · Básico" },
  { value: 2 as const, label: "Nivel 2 · Intermedio" },
  { value: 3 as const, label: "Nivel 3 · Avanzado" },
];

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />
      )}
    </label>
  );
}

function updateBothLocales(
  content: SiteContent,
  updater: (dict: Dictionary, locale: Locale) => void,
): SiteContent {
  const next = structuredClone(content);
  updater(next.en, "en");
  updater(next.es, "es");
  return next;
}

function updateOneLocale(
  content: SiteContent,
  locale: Locale,
  updater: (dict: Dictionary) => void,
): SiteContent {
  const next = structuredClone(content);
  updater(next[locale]);
  return next;
}

function findWorkshop(dict: Dictionary, catIndex: number, workshopId: string) {
  return dict.workshops.categories[catIndex]?.workshops.find((item) => item.id === workshopId);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function levelLabel(level: number) {
  return LEVEL_OPTIONS.find((item) => item.value === level)?.label || `Nivel ${level}`;
}

function exportWorkshopDocument({
  flowerName,
  flowerSubtitle,
  workshop,
}: {
  flowerName: string;
  flowerSubtitle: string;
  workshop: Dictionary["workshops"]["categories"][number]["workshops"][number];
}) {
  const materials = workshop.materials || [];
  const steps = workshop.steps || [];
  const materialsHtml = materials.length
    ? `<ul>${materials.map((item) => `<li>${escapeHtml(item.title)}</li>`).join("")}</ul>`
    : "<p>Sin materiales registrados.</p>";
  const stepsHtml = steps.length
    ? `<ol>${steps
        .map((step, index) => {
          const simbologia = (step.simbologia || "").trim();
          return `<li>
            <strong>Paso ${index + 1}.</strong> ${escapeHtml(step.title)}${
              step.done ? " <em>(completado)</em>" : ""
            }
            ${
              simbologia
                ? `<div class="simbologia"><span>Simbología:</span> ${escapeHtml(
                    simbologia,
                  ).replace(/\n/g, "<br/>")}</div>`
                : ""
            }
          </li>`;
        })
        .join("")}</ol>`
    : "<p>Sin pasos registrados.</p>";

  const body = `
    <header>
      <p class="brand">Inspiralab</p>
      <h1>${escapeHtml(workshop.title || "Taller")}</h1>
      <p class="meta">${escapeHtml(flowerName)} · ${escapeHtml(flowerSubtitle)}</p>
    </header>
    <section>
      <h2>Ficha del taller</h2>
      <table>
        <tr><th>Duración</th><td>${escapeHtml(workshop.duration || "—")}</td></tr>
        <tr><th>Nivel</th><td>${escapeHtml(levelLabel(workshop.level || 1))}</td></tr>
        <tr><th>Coach</th><td>${escapeHtml(workshop.coach || "—")}</td></tr>
      </table>
    </section>
    <section>
      <h2>Descripción</h2>
      <p>${escapeHtml(workshop.text || "Sin descripción.").replace(/\n/g, "<br/>")}</p>
    </section>
    <section>
      <h2>Materiales</h2>
      ${materialsHtml}
    </section>
    <section>
      <h2>Paso a paso</h2>
      ${stepsHtml}
    </section>
    ${
      workshop.youtubeUrl
        ? `<section><h2>Video</h2><p>${escapeHtml(workshop.youtubeUrl)}</p></section>`
        : ""
    }
  `;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(workshop.title || "Taller")} · Inspiralab</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 720px; margin: 0 auto; padding: 32px 24px; line-height: 1.5; }
    .brand { color: #e00d45; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; margin: 0; }
    h1 { font-size: 28px; margin: 8px 0 4px; }
    .meta { color: #666; margin: 0 0 24px; }
    h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    th { width: 140px; color: #666; font-weight: 600; }
    ul, ol { padding-left: 1.25rem; margin: 0; }
    li { margin: 10px 0; }
    .simbologia { margin-top: 4px; color: #555; font-size: 0.95em; }
    .simbologia span { font-weight: 600; color: #333; }
    @media print { body { padding: 0; } @page { margin: 14mm; } }
  </style>
</head>
<body>${body}</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    alert("Permite ventanas emergentes para exportar el documento");
    return;
  }
  win.addEventListener("load", () => {
    try {
      win.focus();
      win.print();
    } catch {
      // impresión manual
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}

export function WorkshopsBoard() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useAdminLanguage();
  const [locale, setLocale] = useState<Locale>("es");
  const [content, setContent] = useState<SiteContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stepDrafts, setStepDrafts] = useState<Record<string, string>>({});
  const [materialDrafts, setMaterialDrafts] = useState<Record<string, string>>({});
  const [activeFlower, setActiveFlower] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [leaveLogout, setLeaveLogout] = useState(false);
  const { isDirty, markSaved } = useUnsavedChanges(content);
  const leaveDialogOpen = leaveTarget !== null || leaveLogout;

  useEffect(() => {
    void fetch("/api/content", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: SiteContent) => setContent(data))
      .catch(() => {});
  }, []);

  async function save(): Promise<boolean> {
    if (!content) return false;
    setSaving(true);
    const res = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    setSaving(false);
    if (res.ok) {
      markSaved();
      toast.success(t.workshops.saved);
      return true;
    }
    toast.error(t.common.errorSave);
    return false;
  }

  async function doLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function requestNavigate(href: string) {
    if (!isDirty) {
      router.push(href);
      return;
    }
    setLeaveLogout(false);
    setLeaveTarget(href);
  }

  function requestLogout() {
    if (!isDirty) {
      void doLogout();
      return;
    }
    setLeaveTarget(null);
    setLeaveLogout(true);
  }

  function closeLeaveDialog() {
    setLeaveTarget(null);
    setLeaveLogout(false);
  }

  async function handleSaveAndLeave() {
    const ok = await save();
    if (!ok) return;
    const href = leaveTarget;
    const shouldLogout = leaveLogout;
    closeLeaveDialog();
    if (shouldLogout) {
      await doLogout();
      return;
    }
    if (href) router.push(href);
  }

  function handleLeaveWithoutSaving() {
    const href = leaveTarget;
    const shouldLogout = leaveLogout;
    closeLeaveDialog();
    if (shouldLogout) {
      void doLogout();
      return;
    }
    if (href) router.push(href);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function uploadImage(catIndex: number, workshopId: string, file: File) {
    const key = `${catIndex}-${workshopId}`;
    setUploadingKey(key);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        toast.error("Error al subir la imagen");
        return;
      }
      const data = (await res.json()) as { url: string };
      setContent((prev) =>
        prev
          ? updateBothLocales(prev, (dict) => {
              const workshop = findWorkshop(dict, catIndex, workshopId);
              if (workshop) workshop.image = data.url;
            })
          : prev,
      );
      toast.success(t.workshops.imageUpdated);
    } finally {
      setUploadingKey(null);
    }
  }

  function addWorkshop(catIndex: number) {
    const id = createWorkshopId();
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict, lang) => {
            dict.workshops.categories[catIndex]?.workshops.push({
              id,
              title: lang === "es" ? "Nuevo taller" : "New workshop",
              text: "",
              image: "",
              youtubeUrl: "",
              duration: "",
              level: 1,
              coach: "",
              materials: [],
              steps: [],
            });
          })
        : prev,
    );
    setExpandedIds((prev) => new Set(prev).add(id));
  }

  function handleAssistantCreate(draft: WorkshopAssistantDraft) {
    const id = createWorkshopId();
    const flowerIndex = Math.min(
      Math.max(0, draft.flowerIndex),
      FLOWER_LABELS.es.length - 1,
    );
    setContent((prev) => {
      if (!prev) return prev;
      return updateBothLocales(prev, (dict, lang) => {
        const category = dict.workshops.categories[flowerIndex];
        if (!category) return;
        category.workshops.push({
          id,
          title: lang === "es" ? draft.titleEs : draft.titleEn,
          text: lang === "es" ? draft.textEs : draft.textEn,
          image: "",
          youtubeUrl: "",
          duration: draft.duration,
          level: draft.level,
          coach: draft.coach,
          materials: draft.materials.map((title) => ({
            id: createWorkshopId(),
            title,
          })),
          steps: draft.steps.map((step) => ({
            id: createWorkshopId(),
            title: step.title,
            done: false,
            simbologia: step.simbologia,
          })),
        });
      });
    });
    setActiveFlower(flowerIndex);
    setExpandedIds((prev) => new Set(prev).add(id));
    setAssistantOpen(false);
    toast.success(t.workshops.created);
    return true;
  }

  function removeWorkshop(catIndex: number, workshopId: string) {
    if (!window.confirm(t.workshops.deleteConfirm)) return;
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const category = dict.workshops.categories[catIndex];
            if (!category) return;
            category.workshops = category.workshops.filter((item) => item.id !== workshopId);
          })
        : prev,
    );
  }

  function patchShared(
    catIndex: number,
    workshopId: string,
    patch: Partial<{
      duration: string;
      level: 1 | 2 | 3;
      coach: string;
      youtubeUrl: string;
      image: string;
    }>,
  ) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const workshop = findWorkshop(dict, catIndex, workshopId);
            if (!workshop) return;
            Object.assign(workshop, patch);
          })
        : prev,
    );
  }

  function addStep(catIndex: number, workshopId: string) {
    const title = (stepDrafts[workshopId] || "").trim();
    if (!title) return;
    const id = createWorkshopId();
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const workshop = findWorkshop(dict, catIndex, workshopId);
            if (!workshop) return;
            if (!Array.isArray(workshop.steps)) workshop.steps = [];
            workshop.steps.push({ id, title, done: false, simbologia: "" });
          })
        : prev,
    );
    setStepDrafts((prev) => ({ ...prev, [workshopId]: "" }));
  }

  function toggleStep(catIndex: number, workshopId: string, stepId: string) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const step = findWorkshop(dict, catIndex, workshopId)?.steps.find(
              (item) => item.id === stepId,
            );
            if (step) step.done = !step.done;
          })
        : prev,
    );
  }

  function updateStepTitle(
    catIndex: number,
    workshopId: string,
    stepId: string,
    title: string,
  ) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const step = findWorkshop(dict, catIndex, workshopId)?.steps.find(
              (item) => item.id === stepId,
            );
            if (step) step.title = title;
          })
        : prev,
    );
  }

  function updateStepSimbologia(
    catIndex: number,
    workshopId: string,
    stepId: string,
    simbologia: string,
  ) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const step = findWorkshop(dict, catIndex, workshopId)?.steps.find(
              (item) => item.id === stepId,
            );
            if (step) step.simbologia = simbologia;
          })
        : prev,
    );
  }

  function removeStep(catIndex: number, workshopId: string, stepId: string) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const workshop = findWorkshop(dict, catIndex, workshopId);
            if (!workshop) return;
            workshop.steps = workshop.steps.filter((item) => item.id !== stepId);
          })
        : prev,
    );
  }

  function addMaterial(catIndex: number, workshopId: string) {
    const title = (materialDrafts[workshopId] || "").trim();
    if (!title) return;
    const id = createWorkshopId();
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const workshop = findWorkshop(dict, catIndex, workshopId);
            if (!workshop) return;
            if (!Array.isArray(workshop.materials)) workshop.materials = [];
            workshop.materials.push({ id, title });
          })
        : prev,
    );
    setMaterialDrafts((prev) => ({ ...prev, [workshopId]: "" }));
  }

  function updateMaterialTitle(
    catIndex: number,
    workshopId: string,
    materialId: string,
    title: string,
  ) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const material = findWorkshop(dict, catIndex, workshopId)?.materials.find(
              (item) => item.id === materialId,
            );
            if (material) material.title = title;
          })
        : prev,
    );
  }

  function removeMaterial(catIndex: number, workshopId: string, materialId: string) {
    setContent((prev) =>
      prev
        ? updateBothLocales(prev, (dict) => {
            const workshop = findWorkshop(dict, catIndex, workshopId);
            if (!workshop) return;
            workshop.materials = workshop.materials.filter((item) => item.id !== materialId);
          })
        : prev,
    );
  }

  if (!content) {
    return (
      <div className="p-10 text-sm text-[color:var(--muted)]">{t.workshops.loading}</div>
    );
  }

  const site = content[locale];
  const category = site.workshops.categories[activeFlower];
  const levelOptions = [
    { value: 1 as const, label: `${t.workshops.level1} · ${t.workshops.basic}` },
    { value: 2 as const, label: `${t.workshops.level2} · ${t.workshops.intermediate}` },
    { value: 3 as const, label: `${t.workshops.level3} · ${t.workshops.advanced}` },
  ];

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--accent)]">
              {t.workshops.pageTitle}
            </p>
            <p className="text-xs text-[color:var(--muted)]">
              {t.workshops.pageSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-[color:var(--line)] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={`px-3 py-1.5 ${locale === "es" ? "bg-[color:var(--accent)] text-white" : ""}`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`px-3 py-1.5 ${locale === "en" ? "bg-[color:var(--accent)] text-white" : ""}`}
              >
                EN
              </button>
            </div>
            <AdminLanguageSwitcher />
            <button
              type="button"
              onClick={() => requestNavigate("/")}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.common.viewSite}
            </button>
            <button
              type="button"
              onClick={() => requestNavigate("/admin")}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.common.panel}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={`bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                isDirty ? "ring-2 ring-[#f59e0b] ring-offset-2" : ""
              }`}
            >
              {saving ? t.common.saving : isDirty ? t.common.saveChanges : t.common.save}
            </button>
            <button
              type="button"
              onClick={requestLogout}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              {t.common.logout}
            </button>
          </div>
        </div>
        <UnsavedChangesReminder
          visible={isDirty}
          saving={saving}
          onSave={() => void save()}
        />
      </header>

      <UnsavedLeaveDialog
        open={leaveDialogOpen}
        saving={saving}
        onSaveAndLeave={() => void handleSaveAndLeave()}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        onCancel={closeLeaveDialog}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-8 pb-16 md:px-8">
        <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[color:var(--ink)]">
            {t.workshops.publicSection}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Textos del encabezado de la sección Talleres en la home.
          </p>
          <div className="mt-5 grid gap-4">
            <Field
              label={t.workshops.eyebrow}
              value={site.workshops.eyebrow}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOneLocale(prev, locale, (dict) => {
                        dict.workshops.eyebrow = value;
                      })
                    : prev,
                )
              }
            />
            <Field
              label={t.workshops.title}
              value={site.workshops.title}
              multiline
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOneLocale(prev, locale, (dict) => {
                        dict.workshops.title = value;
                      })
                    : prev,
                )
              }
            />
            <Field
              label={t.workshops.description}
              value={site.workshops.body}
              multiline
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOneLocale(prev, locale, (dict) => {
                        dict.workshops.body = value;
                      })
                    : prev,
                )
              }
            />
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FLOWER_LABELS[locale].map((label, index) => {
            const count = site.workshops.categories[index]?.workshops.length || 0;
            const active = activeFlower === index;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveFlower(index)}
                className={`shrink-0 border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-[color:var(--accent)] bg-[#fff1f4]"
                    : "border-[color:var(--line)] bg-white"
                }`}
              >
                <p className="font-[family-name:var(--font-display)] text-sm font-bold">
                  {label}
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  {count} {count === 1 ? "taller" : "talleres"}
                </p>
              </button>
            );
          })}
        </div>

        {category ? (
          <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--accent)]">
                  {FLOWER_LABELS[locale][activeFlower]}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Talleres de esta flor · visibles en la home
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAssistantOpen(true)}
                  className="bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white"
                >
                  {t.common.guidedAssistant}
                </button>
                <button
                  type="button"
                  onClick={() => addWorkshop(activeFlower)}
                  className="bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white"
                >
                  {t.workshops.addWorkshop}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field
                label={t.workshops.flowerTitle}
                value={category.title}
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateOneLocale(prev, locale, (dict) => {
                          dict.workshops.categories[activeFlower].title = value;
                        })
                      : prev,
                  )
                }
              />
              <Field
                label={t.workshops.flowerSubtitle}
                value={category.subtitle}
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateOneLocale(prev, locale, (dict) => {
                          dict.workshops.categories[activeFlower].subtitle = value;
                        })
                      : prev,
                  )
                }
              />
            </div>

            <div className="mt-6 grid gap-3">
              {category.workshops.length === 0 ? (
                <div className="border border-dashed border-[color:var(--line)] p-8 text-center text-sm text-[color:var(--muted)]">
                  {t.workshops.noWorkshops}
                </div>
              ) : (
                category.workshops.map((workshop, wIndex) => {
                  const expanded = expandedIds.has(workshop.id);
                  const steps = workshop.steps || [];
                  const materials = workshop.materials || [];
                  const doneCount = steps.filter((step) => step.done).length;
                  const uploadKey = `${activeFlower}-${workshop.id}`;

                  return (
                    <article
                      key={workshop.id || wIndex}
                      className="border border-[color:var(--line)] bg-[color:var(--mist)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(workshop.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="text-xs font-semibold text-[color:var(--muted)]">
                            {expanded ? "▾" : "▸"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-[family-name:var(--font-display)] text-base font-bold text-[color:var(--ink)]">
                              {workshop.title || `Taller ${wIndex + 1}`}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {[
                                workshop.duration || null,
                                `Nivel ${workshop.level || 1}`,
                                workshop.coach ? `Coach: ${workshop.coach}` : null,
                                steps.length
                                  ? `${doneCount}/${steps.length} pasos`
                                  : "Sin paso a paso",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </button>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              exportWorkshopDocument({
                                flowerName: category.title,
                                flowerSubtitle: category.subtitle,
                                workshop,
                              })
                            }
                            className="border border-[color:var(--ink)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)]"
                          >
                            {t.workshops.export}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeWorkshop(activeFlower, workshop.id)}
                            className="border border-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)]"
                          >
                            {t.common.delete}
                          </button>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="space-y-5 border-t border-[color:var(--line)] bg-white px-4 py-5 md:px-5">
                          <div className="grid gap-4">
                            <Field
                              label={t.workshops.workshopTitle}
                              value={workshop.title}
                              onChange={(value) =>
                                setContent((prev) =>
                                  prev
                                    ? updateOneLocale(prev, locale, (dict) => {
                                        const item = findWorkshop(
                                          dict,
                                          activeFlower,
                                          workshop.id,
                                        );
                                        if (item) item.title = value;
                                      })
                                    : prev,
                                )
                              }
                            />
                            <Field
                              label={t.workshops.workshopDesc}
                              value={workshop.text}
                              multiline
                              onChange={(value) =>
                                setContent((prev) =>
                                  prev
                                    ? updateOneLocale(prev, locale, (dict) => {
                                        const item = findWorkshop(
                                          dict,
                                          activeFlower,
                                          workshop.id,
                                        );
                                        if (item) item.text = value;
                                      })
                                    : prev,
                                )
                              }
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <Field
                              label={t.workshops.duration}
                              value={workshop.duration || ""}
                              placeholder={t.workshops.durationPlaceholder}
                              onChange={(value) =>
                                patchShared(activeFlower, workshop.id, { duration: value })
                              }
                            />
                            <label className="block space-y-1.5">
                              <span className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                                Nivel de dificultad
                              </span>
                              <select
                                value={workshop.level || 1}
                                onChange={(e) =>
                                  patchShared(activeFlower, workshop.id, {
                                    level: Number(e.target.value) as 1 | 2 | 3,
                                  })
                                }
                                className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                              >
                                {levelOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Field
                              label={t.workshops.coach}
                              value={workshop.coach || ""}
                              placeholder={t.workshops.coachPlaceholder}
                              onChange={(value) =>
                                patchShared(activeFlower, workshop.id, { coach: value })
                              }
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                                Imagen
                              </p>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void uploadImage(activeFlower, workshop.id, file);
                                  e.target.value = "";
                                }}
                                className="block w-full text-xs"
                              />
                              {uploadingKey === uploadKey && (
                                <p className="text-xs text-[color:var(--muted)]">Subiendo…</p>
                              )}
                              {workshop.image ? (
                                <div className="space-y-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={workshop.image}
                                    alt=""
                                    className="h-28 w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-[color:var(--accent)]"
                                    onClick={() =>
                                      patchShared(activeFlower, workshop.id, { image: "" })
                                    }
                                  >
                                    {t.workshops.removeImage}
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <Field
                              label="URL de YouTube"
                              value={workshop.youtubeUrl || ""}
                              placeholder="https://www.youtube.com/watch?v=..."
                              onChange={(value) =>
                                patchShared(activeFlower, workshop.id, { youtubeUrl: value })
                              }
                            />
                          </div>

                          <div className="border border-[color:var(--line)] p-4">
                            <h3 className="text-sm font-bold text-[color:var(--ink)]">
                              {t.workshops.materials}
                            </h3>
                            <p className="text-xs text-[color:var(--muted)]">
                              Lo que se lleva o se usa en el taller
                            </p>
                            <ul className="mt-3 space-y-2">
                              {materials.length === 0 ? (
                                <li className="text-sm text-[color:var(--muted)]">
                                  {t.workshops.noMaterials}
                                </li>
                              ) : (
                                materials.map((material) => (
                                  <li
                                    key={material.id}
                                    className="flex items-center gap-2 border border-[color:var(--line)] bg-[color:var(--mist)] px-3 py-2"
                                  >
                                    <input
                                      value={material.title}
                                      onChange={(e) =>
                                        updateMaterialTitle(
                                          activeFlower,
                                          workshop.id,
                                          material.id,
                                          e.target.value,
                                        )
                                      }
                                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeMaterial(activeFlower, workshop.id, material.id)
                                      }
                                      className="text-xs font-semibold text-[color:var(--accent)]"
                                    >
                                      {t.common.remove}
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                            <form
                              className="mt-3 flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                addMaterial(activeFlower, workshop.id);
                              }}
                            >
                              <input
                                value={materialDrafts[workshop.id] || ""}
                                onChange={(e) =>
                                  setMaterialDrafts((prev) => ({
                                    ...prev,
                                    [workshop.id]: e.target.value,
                                  }))
                                }
                                placeholder={t.workshops.materialsPlaceholder}
                                className="min-w-0 flex-1 border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                              />
                              <button
                                type="submit"
                                className="bg-[color:var(--ink)] px-3 py-2 text-xs font-semibold text-white"
                              >
                                {t.common.add}
                              </button>
                            </form>
                          </div>

                          <div className="border border-[color:var(--line)] p-4">
                            <h3 className="text-sm font-bold text-[color:var(--ink)]">
                              {t.workshops.steps}
                            </h3>
                            <p className="text-xs text-[color:var(--muted)]">
                              Secuencia de la sesión · simbología solo en la exportación (no en
                              la web pública)
                            </p>
                            <ul className="mt-3 space-y-2">
                              {steps.length === 0 ? (
                                <li className="text-sm text-[color:var(--muted)]">
                                  {t.workshops.noSteps}
                                </li>
                              ) : (
                                steps.map((step, index) => (
                                  <li
                                    key={step.id}
                                    className="space-y-2 border border-[color:var(--line)] bg-[color:var(--mist)] px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 shrink-0 text-xs font-semibold text-[color:var(--muted)]">
                                        {index + 1}.
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={step.done}
                                        onChange={() =>
                                          toggleStep(activeFlower, workshop.id, step.id)
                                        }
                                        className="h-4 w-4 accent-[color:var(--accent)]"
                                        title="Marcar paso como hecho"
                                      />
                                      <input
                                        value={step.title}
                                        onChange={(e) =>
                                          updateStepTitle(
                                            activeFlower,
                                            workshop.id,
                                            step.id,
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Descripción del paso"
                                        className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                                          step.done
                                            ? "text-[color:var(--muted)] line-through"
                                            : "text-[color:var(--ink)]"
                                        }`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeStep(activeFlower, workshop.id, step.id)
                                        }
                                        className="text-xs font-semibold text-[color:var(--accent)]"
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                    <label className="block pl-8">
                                      <span className="mb-1 block text-[11px] font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                                        Simbología
                                      </span>
                                      <textarea
                                        value={step.simbologia || ""}
                                        onChange={(e) =>
                                          updateStepSimbologia(
                                            activeFlower,
                                            workshop.id,
                                            step.id,
                                            e.target.value,
                                          )
                                        }
                                        rows={2}
                                        placeholder="Notas de simbología para el documento exportado…"
                                        className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                                      />
                                    </label>
                                  </li>
                                ))
                              )}
                            </ul>
                            <form
                              className="mt-3 flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                addStep(activeFlower, workshop.id);
                              }}
                            >
                              <input
                                value={stepDrafts[workshop.id] || ""}
                                onChange={(e) =>
                                  setStepDrafts((prev) => ({
                                    ...prev,
                                    [workshop.id]: e.target.value,
                                  }))
                                }
                                placeholder={t.workshops.newStep}
                                className="min-w-0 flex-1 border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                              />
                              <button
                                type="submit"
                                className="bg-[color:var(--ink)] px-3 py-2 text-xs font-semibold text-white"
                              >
                                {t.common.add}
                              </button>
                            </form>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--line)] pt-4">
                            <button
                              type="button"
                              onClick={() =>
                                exportWorkshopDocument({
                                  flowerName: category.title,
                                  flowerSubtitle: category.subtitle,
                                  workshop,
                                })
                              }
                              className="bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                            >
                              {t.workshops.exportFull}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
      </main>
      <AdminFooter />

      <WorkshopsAssistant
        open={assistantOpen}
        flowerLabels={FLOWER_LABELS.es}
        defaultFlowerIndex={activeFlower}
        saving={saving}
        onClose={() => setAssistantOpen(false)}
        onCreate={handleAssistantCreate}
      />
    </div>
  );
}
