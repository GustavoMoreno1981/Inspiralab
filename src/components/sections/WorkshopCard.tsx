"use client";

import { extractYoutubeId } from "@/lib/media/youtube";
import { workshopCoachesLabel } from "@/lib/content/workshop-coaches";

export type WorkshopCardData = {
  id?: string;
  title: string;
  text: string;
  image?: string;
  youtubeUrl?: string;
  duration?: string;
  level?: number;
  coaches?: string[];
  coach?: string;
  studyContent?: Array<{ id?: string; title: string; url: string }>;
};

export function WorkshopCard({ workshop }: { workshop: WorkshopCardData }) {
  const youtubeId = extractYoutubeId(workshop.youtubeUrl || "");
  const coachesLabel = workshopCoachesLabel(workshop);

  return (
    <li className="px-6 py-5 md:px-7">
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
      {(workshop.duration || workshop.level || coachesLabel) && (
        <p className="mt-1.5 text-xs font-medium text-[color:var(--accent)]">
          {[
            workshop.duration || null,
            workshop.level ? `Nivel ${workshop.level}` : null,
            coachesLabel || null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
        {workshop.text}
      </p>
      {(workshop.studyContent || []).filter((item) => item.title && item.url).length > 0 ? (
        <ul className="mt-4 space-y-2">
          {(workshop.studyContent || [])
            .filter((item) => item.title && item.url)
            .map((item, index) => (
              <li key={item.id || `${item.title}-${index}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                >
                  {item.title}
                </a>
              </li>
            ))}
        </ul>
      ) : null}
    </li>
  );
}
