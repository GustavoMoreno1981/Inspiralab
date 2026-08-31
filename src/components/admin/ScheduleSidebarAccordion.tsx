"use client";

import { useState, type ReactNode } from "react";

type Variant = "amber" | "default" | "red";

const VARIANT_STYLES: Record<
  Variant,
  { border: string; bg: string; title: string; hint: string }
> = {
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50/80",
    title: "text-amber-950",
    hint: "text-amber-900",
  },
  default: {
    border: "border-[color:var(--line)]",
    bg: "bg-white",
    title: "text-[color:var(--ink)]",
    hint: "text-[color:var(--muted)]",
  },
  red: {
    border: "border-red-200",
    bg: "bg-red-50/70",
    title: "text-red-950",
    hint: "text-red-900",
  },
};

type Props = {
  title: string;
  count?: number;
  hint?: string;
  variant?: Variant;
  defaultOpen?: boolean;
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
};

export function ScheduleSidebarAccordion({
  title,
  count,
  hint,
  variant = "default",
  defaultOpen = false,
  children,
  emptyMessage,
  isEmpty = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = VARIANT_STYLES[variant];
  const label = count !== undefined ? `${title} (${count})` : title;

  return (
    <div className={`border ${styles.border} ${styles.bg}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className={`block text-sm font-semibold ${styles.title}`}>{label}</span>
          {hint ? (
            <span className={`mt-0.5 block text-xs ${styles.hint}`}>{hint}</span>
          ) : null}
        </span>
        <span
          className={`mt-0.5 shrink-0 text-xs font-semibold text-[color:var(--muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-[color:var(--line)]/60 px-4 pb-4 pt-3">
          {isEmpty && emptyMessage ? (
            <p className="text-sm text-[color:var(--muted)]">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}
