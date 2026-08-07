"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Gallery } from "@/components/sections/Gallery";
import { Hero } from "@/components/sections/Hero";
import { Impact } from "@/components/sections/Impact";
import { Workshops } from "@/components/sections/Workshops";
import { ContentProvider } from "@/lib/content/ContentContext";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export function SiteShell() {
  return (
    <ContentProvider>
      <LanguageProvider>
        <Header />
        <main>
          <Hero />
          <About />
          <Workshops />
          <Impact />
          <Gallery />
          <Contact />
        </main>
        <Footer />
      </LanguageProvider>
    </ContentProvider>
  );
}
