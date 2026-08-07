"use client";

import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { extractYoutubeId } from "@/lib/media/youtube";

export function Workshops() {
  const { t } = useLanguage();

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
          {t.workshops.categories.map((category, index) => (
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
                  {category.workshops.map((workshop) => {
                    const youtubeId = extractYoutubeId(workshop.youtubeUrl || "");
                    return (
                      <li key={workshop.id || workshop.title} className="px-6 py-5 md:px-7">
                        {(workshop.image || youtubeId) && (
                          <div className="mb-4 space-y-3">
                            {workshop.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={workshop.image}
                                alt={workshop.title}
                                className="aspect-video w-full object-cover"
                              />
                            ) : null}
                            {youtubeId ? (
                              <div className="relative aspect-video w-full overflow-hidden bg-black">
                                <iframe
                                  className="absolute inset-0 h-full w-full"
                                  src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                                  title={workshop.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                  loading="lazy"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                        <h4 className="font-[family-name:var(--font-display)] text-base font-semibold text-[color:var(--ink)]">
                          {workshop.title}
                        </h4>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                          {workshop.text}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
