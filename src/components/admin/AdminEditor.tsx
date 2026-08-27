"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GalleryAdminSection } from "@/components/admin/GalleryAdminSection";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { UnsavedChangesReminder } from "@/components/admin/UnsavedChangesReminder";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
import { useToast } from "@/components/admin/AdminToast";
import type { Dictionary, Locale, SiteContent } from "@/lib/i18n/dictionaries";

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
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
          className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />
      )}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
        {title}
      </h2>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function updateLocale(
  content: SiteContent,
  locale: Locale,
  updater: (dict: Dictionary) => Dictionary,
): SiteContent {
  return {
    ...content,
    [locale]: updater(structuredClone(content[locale])),
  };
}

export function AdminEditor() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("es");
  const [content, setContent] = useState<SiteContent | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { isDirty, markSaved } = useUnsavedChanges(content);

  useEffect(() => {
    void fetch("/api/content", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: SiteContent) => setContent(data));
  }, []);

  async function save() {
    if (!content) return;
    setSaving(true);
    setStatus("");
    const res = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    setSaving(false);
    if (res.ok) {
      markSaved();
      setStatus("Cambios guardados");
      toast.success("Cambios del sitio guardados");
    } else {
      setStatus("Error al guardar");
      toast.error("Error al guardar los cambios del sitio");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!content) {
    return <div className="p-10 text-sm text-[color:var(--muted)]">Cargando editor...</div>;
  }

  const t = content[locale];

  return (
    <div className="flex min-h-[100svh] flex-col bg-[color:var(--mist)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--accent)]">
              Editar sitio web
            </p>
            <p className="text-xs text-[color:var(--muted)]">Textos, media y contenido del sitio</p>
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
            <Link href="/admin" className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold">
              Panel
            </Link>
            <Link href="/" className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold">
              Ver sitio
            </Link>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={`bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                isDirty ? "ring-2 ring-[#f59e0b] ring-offset-2" : ""
              }`}
            >
              {saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="border border-[color:var(--line)] px-3 py-2 text-xs font-semibold"
            >
              Salir
            </button>
          </div>
        </div>
        <UnsavedChangesReminder
          visible={isDirty}
          saving={saving}
          onSave={() => void save()}
        />
        {status && (
          <p className="border-t border-[color:var(--line)] bg-white px-5 py-2 text-center text-sm text-[color:var(--accent)] md:px-8">
            {status}
          </p>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-5 px-5 py-8 pb-12 md:px-8">
        <Section title="Navegación">
          {(Object.keys(t.nav) as Array<keyof typeof t.nav>).map((key) => (
            <Field
              key={key}
              label={key}
              value={t.nav[key]}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateLocale(prev, locale, (dict) => {
                        dict.nav[key] = value;
                        return dict;
                      })
                    : prev,
                )
              }
            />
          ))}
        </Section>

        <Section title="Home / Hero">
          {(Object.keys(t.hero) as Array<keyof typeof t.hero>)
            .filter((key) => key !== "videoUrl")
            .map((key) => (
              <Field
                key={key}
                label={key}
                value={t.hero[key]}
                multiline={key === "subhead"}
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateLocale(prev, locale, (dict) => {
                          dict.hero[key] = value;
                          return dict;
                        })
                      : prev,
                  )
                }
              />
            ))}
          <Field
            label={locale === "es" ? "URL del video de YouTube" : "YouTube video URL"}
            value={t.hero.videoUrl || ""}
            onChange={(value) =>
              setContent((prev) => {
                if (!prev) return prev;
                const next = structuredClone(prev);
                next.en.hero.videoUrl = value;
                next.es.hero.videoUrl = value;
                return next;
              })
            }
          />
        </Section>

        <Section title="About Us">
          <Field
            label="eyebrow"
            value={t.about.eyebrow}
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.about.eyebrow = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          <Field
            label="title"
            value={t.about.title}
            multiline
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.about.title = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          <Field
            label="body"
            value={t.about.body}
            multiline
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.about.body = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          {t.about.values.map((valueItem, index) => (
            <div key={index} className="grid gap-3 border border-[color:var(--line)] p-4">
              <p className="text-xs font-semibold text-[color:var(--accent)]">Valor {index + 1}</p>
              <Field
                label="title"
                value={valueItem.title}
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateLocale(prev, locale, (dict) => {
                          dict.about.values[index].title = value;
                          return dict;
                        })
                      : prev,
                  )
                }
              />
              <Field
                label="text"
                value={valueItem.text}
                multiline
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateLocale(prev, locale, (dict) => {
                          dict.about.values[index].text = value;
                          return dict;
                        })
                      : prev,
                  )
                }
              />
            </div>
          ))}
        </Section>

        <section className="border border-[color:var(--line)] bg-white p-5 md:p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--ink)]">
            Talleres
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Los talleres de las tres flores se gestionan en su propio módulo para
            organizarlos y publicarlos en la página principal.
          </p>
          <Link
            href="/admin/talleres"
            className="mt-4 inline-flex bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Ir a Talleres
          </Link>
        </section>

        <Section title="Impact">
          <Field
            label="eyebrow"
            value={t.impact.eyebrow}
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.impact.eyebrow = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          <Field
            label="title"
            value={t.impact.title}
            multiline
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.impact.title = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          <Field
            label="body"
            value={t.impact.body}
            multiline
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.impact.body = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          {t.impact.stats.map((stat, index) => (
            <div key={index} className="grid gap-3 border border-[color:var(--line)] p-4 sm:grid-cols-2">
              <Field
                label="value"
                value={stat.value}
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateLocale(prev, locale, (dict) => {
                          dict.impact.stats[index].value = value;
                          return dict;
                        })
                      : prev,
                  )
                }
              />
              <Field
                label="label"
                value={stat.label}
                onChange={(value) =>
                  setContent((prev) =>
                    prev
                      ? updateLocale(prev, locale, (dict) => {
                          dict.impact.stats[index].label = value;
                          return dict;
                        })
                      : prev,
                  )
                }
              />
            </div>
          ))}
        </Section>

        <GalleryAdminSection content={content} locale={locale} setContent={setContent} />

        <Section title="Contact">
          {(Object.keys(t.contact) as Array<keyof typeof t.contact>).map((key) => (
            <Field
              key={key}
              label={key}
              value={t.contact[key]}
              multiline={key === "body" || key === "placeholderMessage"}
              onChange={(value) =>
                setContent((prev) =>
                  prev
                    ? updateLocale(prev, locale, (dict) => {
                        dict.contact[key] = value;
                        return dict;
                      })
                    : prev,
                )
              }
            />
          ))}
        </Section>

        <Section title="Footer">
          <Field
            label="tagline"
            value={t.footer.tagline}
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.footer.tagline = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
          <Field
            label="rights"
            value={t.footer.rights}
            onChange={(value) =>
              setContent((prev) =>
                prev
                  ? updateLocale(prev, locale, (dict) => {
                      dict.footer.rights = value;
                      return dict;
                    })
                  : prev,
              )
            }
          />
        </Section>
      </div>
      <AdminFooter />
    </div>
  );
}
