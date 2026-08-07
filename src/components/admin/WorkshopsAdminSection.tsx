"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { Dictionary, Locale, SiteContent } from "@/lib/i18n/dictionaries";
import { createWorkshopId } from "@/lib/media/youtube";

const FLOWER_LABELS: Record<Locale, string[]> = {
  es: [
    "Talleres Flor del Amor",
    "Talleres Flor de la Fe",
    "Talleres Flor de la Esperanza",
  ],
  en: [
    "Flower of Love Workshops",
    "Flower of Faith Workshops",
    "Flower of Hope Workshops",
  ],
};

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

type Props = {
  content: SiteContent;
  locale: Locale;
  setContent: Dispatch<SetStateAction<SiteContent | null>>;
};

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

export function WorkshopsAdminSection({ content, locale, setContent }: Props) {
  const t = content[locale];
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  async function uploadImage(catIndex: number, workshopId: string, file: File) {
    const key = `${catIndex}-${workshopId}`;
    setUploadingKey(key);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        alert(locale === "es" ? "Error al subir la imagen" : "Image upload failed");
        return;
      }
      const data = (await res.json()) as { url: string };
      setContent((prev) =>
        prev
          ? updateBothLocales(prev, (dict) => {
              const workshop = dict.workshops.categories[catIndex]?.workshops.find(
                (item) => item.id === workshopId,
              );
              if (workshop) {
                workshop.image = data.url;
              }
            })
          : prev,
      );
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
            });
          })
        : prev,
    );
  }

  function removeWorkshop(catIndex: number, workshopId: string) {
    const confirmMsg =
      locale === "es"
        ? "¿Eliminar este taller en ambos idiomas?"
        : "Delete this workshop in both languages?";
    if (!window.confirm(confirmMsg)) return;

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

  return (
    <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
        Workshops / Talleres
      </h2>
      <div className="mt-5 grid gap-4">
        <Field
          label="eyebrow"
          value={t.workshops.eyebrow}
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
          label="title"
          value={t.workshops.title}
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
          label="body"
          value={t.workshops.body}
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

        {t.workshops.categories.map((category, catIndex) => (
          <div key={catIndex} className="grid gap-4 border border-[color:var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[color:var(--accent)]">
                {FLOWER_LABELS[locale][catIndex] || category.title}
              </h3>
              <button
                type="button"
                onClick={() => addWorkshop(catIndex)}
                className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
              >
                {locale === "es" ? "+ Agregar taller" : "+ Add workshop"}
              </button>
            </div>

            <Field
              label={locale === "es" ? "Título de categoría" : "Category title"}
              value={category.title}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOneLocale(prev, locale, (dict) => {
                        dict.workshops.categories[catIndex].title = value;
                      })
                    : prev,
                )
              }
            />
            <Field
              label={locale === "es" ? "Subtítulo" : "Subtitle"}
              value={category.subtitle}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOneLocale(prev, locale, (dict) => {
                        dict.workshops.categories[catIndex].subtitle = value;
                      })
                    : prev,
                )
              }
            />

            {category.workshops.map((workshop, wIndex) => {
              const uploadKey = `${catIndex}-${workshop.id}`;
              return (
                <div key={workshop.id || wIndex} className="grid gap-3 bg-[color:var(--mist)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[color:var(--muted)]">
                      {locale === "es" ? `Taller ${wIndex + 1}` : `Workshop ${wIndex + 1}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeWorkshop(catIndex, workshop.id)}
                      className="border border-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)]"
                    >
                      {locale === "es" ? "Eliminar" : "Delete"}
                    </button>
                  </div>

                  <Field
                    label={locale === "es" ? "Título" : "Title"}
                    value={workshop.title}
                    onChange={(value) =>
                      setContent((prev) =>
                        prev
                          ? updateOneLocale(prev, locale, (dict) => {
                              const item = dict.workshops.categories[catIndex].workshops.find(
                                (w) => w.id === workshop.id,
                              );
                              if (item) item.title = value;
                            })
                          : prev,
                      )
                    }
                  />
                  <Field
                    label={locale === "es" ? "Descripción" : "Description"}
                    value={workshop.text}
                    multiline
                    onChange={(value) =>
                      setContent((prev) =>
                        prev
                          ? updateOneLocale(prev, locale, (dict) => {
                              const item = dict.workshops.categories[catIndex].workshops.find(
                                (w) => w.id === workshop.id,
                              );
                              if (item) item.text = value;
                            })
                          : prev,
                      )
                    }
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                        {locale === "es" ? "Imagen" : "Image"}
                      </p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadImage(catIndex, workshop.id, file);
                          e.target.value = "";
                        }}
                        className="block w-full text-xs"
                      />
                      {uploadingKey === uploadKey && (
                        <p className="text-xs text-[color:var(--muted)]">
                          {locale === "es" ? "Subiendo..." : "Uploading..."}
                        </p>
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
                              setContent((prev) =>
                                prev
                                  ? updateBothLocales(prev, (dict) => {
                                      const item = dict.workshops.categories[
                                        catIndex
                                      ]?.workshops.find((w) => w.id === workshop.id);
                                      if (item) item.image = "";
                                    })
                                  : prev,
                              )
                            }
                          >
                            {locale === "es" ? "Quitar imagen" : "Remove image"}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Field
                        label={locale === "es" ? "URL de YouTube" : "YouTube URL"}
                        value={workshop.youtubeUrl || ""}
                        placeholder="https://www.youtube.com/watch?v=..."
                        onChange={(value) =>
                          setContent((prev) =>
                            prev
                              ? updateBothLocales(prev, (dict) => {
                                  const item = dict.workshops.categories[catIndex]?.workshops.find(
                                    (w) => w.id === workshop.id,
                                  );
                                  if (item) item.youtubeUrl = value;
                                })
                              : prev,
                          )
                        }
                      />
                      <p className="text-xs text-[color:var(--muted)]">
                        {locale === "es"
                          ? "Puedes usar imagen o video (o ambos)."
                          : "You can use an image or a video (or both)."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
