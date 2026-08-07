"use client";

import { useState, type FormEvent } from "react";
import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Contact() {
  const { t, locale } = useLanguage();
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <section id="contact" className="bg-[color:var(--mist)] py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 md:grid-cols-[0.9fr_1.1fr] md:gap-20 md:px-8">
        <Reveal>
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--accent)] uppercase">
            {t.contact.eyebrow}
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            {t.contact.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[color:var(--muted)] md:text-lg">
            {t.contact.body}
          </p>
          <div className="mt-10 space-y-3 text-sm text-[color:var(--muted)] md:text-base">
            <p className="font-medium text-[color:var(--ink)]">{t.contact.infoTitle}</p>
            <a
              href="mailto:hello@inspiralab.org"
              className="block text-[color:var(--accent)] transition-opacity hover:opacity-80"
            >
              {t.contact.emailLabel}
            </a>
            <p>{t.contact.location}</p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm text-[color:var(--muted)]">
                {t.contact.name}
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder={t.contact.placeholderName}
                className="w-full border border-[color:var(--line)] bg-white px-4 py-3 text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--muted)]/50 focus:border-[color:var(--accent)]"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-[color:var(--muted)]">
                {t.contact.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder={t.contact.placeholderEmail}
                className="w-full border border-[color:var(--line)] bg-white px-4 py-3 text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--muted)]/50 focus:border-[color:var(--accent)]"
              />
            </div>
            <div>
              <label htmlFor="message" className="mb-2 block text-sm text-[color:var(--muted)]">
                {t.contact.message}
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                placeholder={t.contact.placeholderMessage}
                className="w-full resize-y border border-[color:var(--line)] bg-white px-4 py-3 text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--muted)]/50 focus:border-[color:var(--accent)]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex bg-[color:var(--accent)] px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
            >
              {t.contact.submit}
            </button>
            {sent && (
              <p className="text-sm text-[color:var(--accent)]" role="status">
                {locale === "es"
                  ? "Gracias. Pronto te contactaremos."
                  : "Thanks. We’ll be in touch soon."}
              </p>
            )}
          </form>
        </Reveal>
      </div>
    </section>
  );
}
