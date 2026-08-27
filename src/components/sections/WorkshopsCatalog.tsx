"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Reveal } from "@/components/Reveal";
import { WorkshopCard } from "@/components/sections/WorkshopCard";
import { ContentProvider } from "@/lib/content/ContentContext";
import { LanguageProvider, useLanguage } from "@/lib/i18n/LanguageContext";

function WorkshopsCatalogInner() {
  const { t, locale } = useLanguage();

  return (
    <>
      <Header />
      <main className="flex-1 bg-[color:var(--mist)] pt-24 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <Reveal>
            <Link
              href="/#workshops"
              className="text-sm font-semibold text-[color:var(--accent)] transition-opacity hover:opacity-80"
            >
              ← {t.workshops.backHome}
            </Link>
            <p className="mt-6 text-sm font-semibold tracking-[0.18em] text-[color:var(--accent)] uppercase">
              {t.workshops.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
              {t.workshops.allTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
              {t.workshops.allBody}
            </p>
          </Reveal>

          <nav className="mt-10 flex flex-wrap gap-2">
            {t.workshops.categories.map((category, index) => (
              <a
                key={category.title}
                href={`#flor-${index + 1}`}
                className="border border-[color:var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[color:var(--ink)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                {category.title}
              </a>
            ))}
          </nav>

          <div className="mt-10 space-y-12">
            {t.workshops.categories.map((category, index) => (
              <Reveal key={category.title} delay={index * 80}>
                <section
                  id={`flor-${index + 1}`}
                  className="scroll-mt-28 border border-[color:var(--line)] bg-white"
                >
                  <header className="border-b border-[color:var(--line)] bg-[color:var(--accent)] px-6 py-6 text-white md:px-8">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-90">
                      {category.subtitle}
                    </p>
                    <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight md:text-3xl">
                      {category.title}
                    </h2>
                    <p className="mt-2 text-sm opacity-90">
                      {category.workshops?.length || 0}{" "}
                      {(category.workshops?.length || 0) === 1
                        ? locale === "es"
                          ? "taller"
                          : "workshop"
                        : locale === "es"
                          ? "talleres"
                          : "workshops"}
                    </p>
                  </header>
                  {(category.workshops?.length || 0) === 0 ? (
                    <p className="px-6 py-8 text-sm text-[color:var(--muted)] md:px-8">
                      {locale === "es"
                        ? "Aún no hay talleres en esta flor."
                        : "No workshops in this flower yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--line)]">
                      {(category.workshops || []).map((workshop) => (
                        <WorkshopCard
                          key={workshop.id || workshop.title}
                          workshop={workshop}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function WorkshopsCatalogPage() {
  return (
    <ContentProvider>
      <LanguageProvider>
        <div className="flex min-h-[100svh] flex-col">
          <WorkshopsCatalogInner />
        </div>
      </LanguageProvider>
    </ContentProvider>
  );
}
