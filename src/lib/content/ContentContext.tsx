"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type SiteContent } from "@/lib/i18n/dictionaries";

type ContentContextValue = {
  content: SiteContent;
  loading: boolean;
  refresh: () => Promise<void>;
  setContent: (content: SiteContent) => void;
};

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(dictionaries as SiteContent);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/content", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as SiteContent;
        setContent(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ content, loading, refresh, setContent }),
    [content, loading, refresh],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error("useContent must be used within ContentProvider");
  }
  return ctx;
}
