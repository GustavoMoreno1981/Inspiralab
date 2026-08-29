"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrivateItemType } from "@/lib/tasks/private-auth";

const STORAGE_KEY = "inspiralab_private_unlocked";
const TTL_MS = 24 * 60 * 60 * 1000;

type StoredUnlocks = Record<string, number>;

function itemKey(itemType: PrivateItemType, itemId: string) {
  return `${itemType}:${itemId}`;
}

function readStored(): StoredUnlocks {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredUnlocks;
    const now = Date.now();
    const next: StoredUnlocks = {};
    for (const [key, expiry] of Object.entries(parsed)) {
      if (typeof expiry === "number" && expiry > now) next[key] = expiry;
    }
    return next;
  } catch {
    return {};
  }
}

function writeStored(data: StoredUnlocks) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function usePrivateUnlock() {
  const [unlocked, setUnlocked] = useState<StoredUnlocks>({});

  useEffect(() => {
    setUnlocked(readStored());
  }, []);

  const isUnlocked = useCallback(
    (itemType: PrivateItemType, itemId: string) => {
      const expiry = unlocked[itemKey(itemType, itemId)];
      return typeof expiry === "number" && expiry > Date.now();
    },
    [unlocked],
  );

  const markUnlocked = useCallback((itemType: PrivateItemType, itemId: string) => {
    const next = {
      ...readStored(),
      [itemKey(itemType, itemId)]: Date.now() + TTL_MS,
    };
    writeStored(next);
    setUnlocked(next);
  }, []);

  const lockItem = useCallback((itemType: PrivateItemType, itemId: string) => {
    const next = { ...readStored() };
    delete next[itemKey(itemType, itemId)];
    writeStored(next);
    setUnlocked(next);
  }, []);

  return { isUnlocked, markUnlocked, lockItem };
}
