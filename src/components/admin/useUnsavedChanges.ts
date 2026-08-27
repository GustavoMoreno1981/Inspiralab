"use client";

import { useEffect, useMemo, useState } from "react";

export function useUnsavedChanges<T>(value: T | null) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const serialized = useMemo(
    () => (value === null ? null : JSON.stringify(value)),
    [value],
  );

  useEffect(() => {
    if (serialized !== null && baseline === null) {
      setBaseline(serialized);
    }
  }, [serialized, baseline]);

  const isDirty =
    baseline !== null && serialized !== null && serialized !== baseline;

  function markSaved() {
    if (serialized !== null) setBaseline(serialized);
  }

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  return { isDirty, markSaved };
}
