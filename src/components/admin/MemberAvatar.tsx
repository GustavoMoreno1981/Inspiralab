"use client";

import { useState } from "react";

type Props = {
  name: string;
  photo?: string;
  size?: "sm" | "md" | "lg";
};

export function MemberAvatar({ name, photo, size = "sm" }: Props) {
  const sizeClass =
    size === "lg" ? "h-16 w-16" : size === "md" ? "h-12 w-12" : "h-8 w-8";
  const [broken, setBroken] = useState(false);
  const src = (photo || "").trim();
  const showImage = Boolean(src) && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-[color:var(--mist)] text-sm font-semibold text-[color:var(--muted)]`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
