"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { Dictionary, Locale, SiteContent } from "@/lib/i18n/dictionaries";
import { createWorkshopId } from "@/lib/media/youtube";
import { useToast } from "@/components/admin/AdminToast";

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

function updateBoth(content: SiteContent, updater: (dict: Dictionary) => void): SiteContent {
  const next = structuredClone(content);
  updater(next.en);
  updater(next.es);
  return next;
}

function updateOne(
  content: SiteContent,
  locale: Locale,
  updater: (dict: Dictionary) => void,
): SiteContent {
  const next = structuredClone(content);
  updater(next[locale]);
  return next;
}

export function GalleryAdminSection({ content, locale, setContent }: Props) {
  const t = content[locale];
  const toast = useToast();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function uploadImage(itemId: string, file: File) {
    setUploadingId(itemId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        toast.error(locale === "es" ? "Error al subir la imagen" : "Image upload failed");
        return;
      }
      const data = (await res.json()) as { url: string };
      setContent((prev) =>
        prev
          ? updateBoth(prev, (dict) => {
              const item = dict.gallery.items.find((entry) => entry.id === itemId);
              if (item) item.image = data.url;
            })
          : prev,
      );
      toast.success(locale === "es" ? "Imagen de galería actualizada" : "Gallery image updated");
    } finally {
      setUploadingId(null);
    }
  }

  function addItem() {
    const id = `gallery-${createWorkshopId()}`;
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.en.gallery.items.push({
        id,
        label: "New image",
        alt: "",
        image: "",
      });
      next.es.gallery.items.push({
        id,
        label: "Nueva imagen",
        alt: "",
        image: "",
      });
      return next;
    });
  }

  function removeItem(itemId: string) {
    const msg =
      locale === "es"
        ? "¿Eliminar esta imagen de la galería?"
        : "Delete this gallery image?";
    if (!window.confirm(msg)) return;
    setContent((prev) =>
      prev
        ? updateBoth(prev, (dict) => {
            dict.gallery.items = dict.gallery.items.filter((item) => item.id !== itemId);
          })
        : prev,
    );
  }

  return (
    <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
          Gallery / Galería
        </h2>
        <button
          type="button"
          onClick={addItem}
          className="bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
        >
          {locale === "es" ? "+ Agregar imagen" : "+ Add image"}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <Field
          label="eyebrow"
          value={t.gallery.eyebrow}
          onChange={(value) =>
            setContent((prev) =>
              prev
                ? updateOne(prev, locale, (dict) => {
                    dict.gallery.eyebrow = value;
                  })
                : prev,
            )
          }
        />
        <Field
          label="title"
          value={t.gallery.title}
          multiline
          onChange={(value) =>
            setContent((prev) =>
              prev
                ? updateOne(prev, locale, (dict) => {
                    dict.gallery.title = value;
                  })
                : prev,
            )
          }
        />
        <Field
          label="body"
          value={t.gallery.body}
          multiline
          onChange={(value) =>
            setContent((prev) =>
              prev
                ? updateOne(prev, locale, (dict) => {
                    dict.gallery.body = value;
                  })
                : prev,
            )
          }
        />

        {t.gallery.items.map((item, index) => (
          <div key={item.id || index} className="grid gap-3 border border-[color:var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[color:var(--muted)]">
                {locale === "es" ? `Imagen ${index + 1}` : `Image ${index + 1}`}
              </p>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="border border-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)]"
              >
                {locale === "es" ? "Eliminar" : "Delete"}
              </button>
            </div>

            <Field
              label={locale === "es" ? "Etiqueta" : "Label"}
              value={item.label}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOne(prev, locale, (dict) => {
                        const entry = dict.gallery.items.find((g) => g.id === item.id);
                        if (entry) entry.label = value;
                      })
                    : prev,
                )
              }
            />
            <Field
              label="Alt"
              value={item.alt}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateOne(prev, locale, (dict) => {
                        const entry = dict.gallery.items.find((g) => g.id === item.id);
                        if (entry) entry.alt = value;
                      })
                    : prev,
                )
              }
            />

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-[color:var(--muted)] uppercase">
                {locale === "es" ? "Subir imagen" : "Upload image"}
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(item.id, file);
                  e.target.value = "";
                }}
                className="block w-full text-xs"
              />
              {uploadingId === item.id && (
                <p className="text-xs text-[color:var(--muted)]">
                  {locale === "es" ? "Subiendo..." : "Uploading..."}
                </p>
              )}
              {item.image ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt="" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    className="text-xs font-semibold text-[color:var(--accent)]"
                    onClick={() =>
                      setContent((prev) =>
                        prev
                          ? updateBoth(prev, (dict) => {
                              const entry = dict.gallery.items.find((g) => g.id === item.id);
                              if (entry) entry.image = "";
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
          </div>
        ))}
      </div>
    </section>
  );
}
