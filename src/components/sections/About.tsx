"use client";

import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function About() {
  const { t } = useLanguage();

  return (
    <section id="about" className="bg-[color:var(--paper)] py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 md:grid-cols-[1.1fr_0.9fr] md:gap-20 md:px-8">
        <Reveal>
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--accent-deep)] uppercase">
            {t.about.eyebrow}
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            {t.about.title}
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            {t.about.body}
          </p>
        </Reveal>

        <div className="flex flex-col gap-8 border-l border-[color:var(--line)] pl-6 md:pl-10">
          {t.about.values.map((value, index) => (
            <Reveal key={value.title} delay={index * 90}>
              <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--ink)]">
                {value.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
                {value.text}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
