"use client";

type Props = {
  label: string;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: React.DragEvent<HTMLButtonElement>) => void;
};

export function DragHandle({ label, onDragStart, onDragEnd }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab touch-none border border-transparent px-1 py-1 text-[color:var(--muted)] hover:border-[color:var(--line)] hover:text-[color:var(--ink)] active:cursor-grabbing"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
        <circle cx="7" cy="5" r="1.4" fill="currentColor" />
        <circle cx="13" cy="5" r="1.4" fill="currentColor" />
        <circle cx="7" cy="10" r="1.4" fill="currentColor" />
        <circle cx="13" cy="10" r="1.4" fill="currentColor" />
        <circle cx="7" cy="15" r="1.4" fill="currentColor" />
        <circle cx="13" cy="15" r="1.4" fill="currentColor" />
      </svg>
    </button>
  );
}
