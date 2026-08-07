export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim();
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const embed = parsed.pathname.match(/\/embed\/([^/]+)/);
      if (embed?.[1]) return embed[1];
      const shorts = parsed.pathname.match(/\/shorts\/([^/]+)/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function createWorkshopId() {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
