"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-[#177245] bg-[#e9f8ef] text-[#177245]",
  error: "border-[color:var(--accent)] bg-[#fff1f4] text-[color:var(--accent)]",
  info: "border-[color:var(--line)] bg-white text-[color:var(--ink)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const text = message.trim();
      if (!text) return;
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { id, message: text, tone }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:left-auto sm:items-end"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm border px-4 py-3 text-sm font-semibold shadow-lg sm:w-80 ${TONE_STYLES[item.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 text-xs font-bold opacity-70 hover:opacity-100"
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}
