"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const links = [
  { id: "home", key: "home" as const },
  { id: "about", key: "about" as const },
  { id: "workshops", key: "workshops" as const },
  { id: "impact", key: "impact" as const },
  { id: "gallery", key: "gallery" as const },
  { id: "contact", key: "contact" as const },
];

export function Header() {
  const { t, locale, setLocale } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || open
          ? "border-b border-[color:var(--line)] bg-white/90 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:h-20 md:px-8">
        <a
          href="#home"
          className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[color:var(--accent)] md:text-2xl"
          onClick={() => setOpen(false)}
        >
          Inspiralab
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-[color:var(--ink)] transition-colors hover:text-[color:var(--accent)] xl:text-base"
            >
              {t.nav[link.key]}
            </a>
          ))}
          <div className="ml-2 flex items-center gap-1 rounded-sm border border-[color:var(--line)] p-1 font-[family-name:var(--font-display)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`px-2.5 py-1 transition-colors ${
                locale === "en"
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              }`}
              aria-pressed={locale === "en"}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale("es")}
              className={`px-2.5 py-1 transition-colors ${
                locale === "es"
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              }`}
              aria-pressed={locale === "es"}
            >
              ES
            </button>
          </div>
        </nav>

        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex items-center gap-1 rounded-sm border border-[color:var(--line)] p-1 font-[family-name:var(--font-display)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`px-2 py-1 ${
                locale === "en"
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--ink)]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale("es")}
              className={`px-2 py-1 ${
                locale === "es"
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--ink)]"
              }`}
            >
              ES
            </button>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className={`block h-0.5 w-5 bg-[color:var(--ink)] transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`block h-0.5 w-5 bg-[color:var(--ink)] transition-opacity ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-0.5 w-5 bg-[color:var(--ink)] transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-[color:var(--line)] bg-white transition-all duration-400 lg:hidden ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-5 py-4">
          {links.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="py-3 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[color:var(--ink)]"
              onClick={() => setOpen(false)}
            >
              {t.nav[link.key]}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
