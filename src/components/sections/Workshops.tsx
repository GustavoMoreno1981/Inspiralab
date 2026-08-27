"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { WorkshopCard } from "@/components/sections/WorkshopCard";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const HOME_LIMIT = 3;

export function Workshops() {
  const { t, locale } = useLanguage();

  return (
    <section id="workshops" className="bg-[color:var(--mist)] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--accent)] uppercase">
            {t.workshops.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            {t.workshops.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            {t.workshops.body}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {t.workshops.categories.map((category, index) => {
            const preview = (category.workshops || []).slice(0, HOME_LIMIT);
            const remaining = Math.max(
              0,
              (category.workshops?.length || 0) - HOME_LIMIT,
            );
            return (
              <Reveal key={category.title} delay={index * 90} className="h-full">
                <article className="flex h-full flex-col border border-[color:var(--line)] bg-white">
                  <header className="border-b border-[color:var(--line)] bg-[color:var(--accent)] px-6 py-6 text-white md:px-7">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-90">
                      {category.subtitle}
                    </p>
                    <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">
                      {category.title}
                    </h3>
                  </header>

                  <ul className="flex flex-1 flex-col divide-y divide-[color:var(--line)]">
                    {preview.map((workshop) => (
                      <WorkshopCard
                        key={workshop.id || workshop.title}
                        workshop={workshop}
                      />
                    ))}
                  </ul>

                  {remaining > 0 ? (
                    <p className="border-t border-[color:var(--line)] px-6 py-3 text-xs text-[color:var(--muted)] md:px-7">
                      +{remaining}{" "}
                      {locale === "es"
                        ? remaining === 1
                          ? "taller más"
                          : "talleres más"
                        : remaining === 1
                          ? "more workshop"
                          : "more workshops"}
                    </p>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={280}>
          <div className="mt-10 flex justify-center">
            <Link
              href="/talleres"
              className="bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t.workshops.viewAll}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
