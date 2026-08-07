"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import { extractYoutubeId } from "@/lib/media/youtube";

export function Hero() {
  const { t } = useLanguage();
  const videoId = extractYoutubeId(t.hero.videoUrl || "");

  return (
    <section id="home" className="relative min-h-[100svh] overflow-hidden bg-white">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_40%,rgba(224,13,69,0.08),transparent_50%),linear-gradient(180deg,#fff_0%,#faf6f7_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid min-h-[100svh] max-w-6xl items-center gap-10 px-5 pb-16 pt-28 md:px-8 md:pb-20 lg:grid-cols-2 lg:gap-14 lg:pt-24">
        <div className="flex flex-col justify-center">
          <p className="hero-brand font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[0.95] tracking-tight text-[color:var(--accent)] sm:text-6xl md:text-7xl">
            {t.hero.brand}
          </p>
          <h1 className="hero-line mt-6 max-w-xl font-[family-name:var(--font-display)] text-3xl font-bold leading-snug text-[color:var(--ink)] sm:text-4xl">
            {t.hero.headline}
          </h1>
          <p className="hero-line hero-line-delay mt-5 max-w-lg text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            {t.hero.subhead}
          </p>
          <div className="hero-line hero-line-delay-2 mt-10 flex flex-wrap gap-3">
            <a
              href="#workshops"
              className="inline-flex items-center bg-[color:var(--accent)] px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
            >
              {t.hero.ctaPrimary}
            </a>
            <a
              href="#contact"
              className="inline-flex items-center border border-[color:var(--ink)]/20 px-6 py-3.5 text-sm font-semibold text-[color:var(--ink)] transition-colors duration-300 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              {t.hero.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="hero-line hero-line-delay w-full">
          <div className="overflow-hidden border border-[color:var(--line)] bg-black shadow-[0_24px_60px_-28px_rgba(224,13,69,0.35)]">
            <div className="relative aspect-video w-full">
              {videoId ? (
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                  title={t.hero.brand}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--mist)] px-6 text-center text-sm text-[color:var(--muted)]">
                  {t.hero.brand}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
