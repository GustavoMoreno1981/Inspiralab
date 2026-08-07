"use client";

import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Impact() {
  const { t } = useLanguage();

  return (
    <section id="impact" className="relative overflow-hidden bg-[color:var(--mist)] py-24 md:py-32">
      <div
        className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[color:var(--accent)]/15 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--accent-deep)] uppercase">
            {t.impact.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            {t.impact.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            {t.impact.body}
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 md:gap-x-6">
          {t.impact.stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 80}>
              <p className="font-[family-name:var(--font-display)] text-4xl font-extrabold text-[color:var(--accent)] md:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted)] md:text-base">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
