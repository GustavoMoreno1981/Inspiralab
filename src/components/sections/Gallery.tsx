"use client";

import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const tones = [
  "from-[#f4d5de] to-[#e8a9bb]",
  "from-[#e00d45] to-[#f07a9a]",
  "from-[#efe6e9] to-[#d9c2ca]",
  "from-[#f2b8c8] to-[#e00d45]",
  "from-[#f7eef1] to-[#e8c5d0]",
  "from-[#e85a7f] to-[#e00d45]",
];

export function Gallery() {
  const { t } = useLanguage();

  return (
    <section id="gallery" className="bg-[color:var(--paper)] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--accent-deep)] uppercase">
            {t.gallery.eyebrow}
          </p>
          <h2 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            {t.gallery.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            {t.gallery.body}
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {t.gallery.items.map((item, index) => (
            <Reveal
              key={item.id || item.label}
              delay={index * 60}
              className={index % 5 === 0 ? "md:row-span-2" : ""}
            >
              <figure
                className={`gallery-tile group relative min-h-44 overflow-hidden md:min-h-52 ${
                  index % 5 === 0 ? "md:min-h-full md:h-full" : ""
                }`}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.alt || item.label}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${tones[index % tones.length]} transition-transform duration-700 group-hover:scale-105`}
                  />
                )}
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-4 text-sm font-medium text-white md:p-5 md:text-base">
                  {item.label}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
