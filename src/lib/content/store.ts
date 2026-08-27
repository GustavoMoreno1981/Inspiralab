import { promises as fs } from "fs";
import path from "path";
import { dictionaries, type Dictionary, type SiteContent } from "@/lib/i18n/dictionaries";
import { createWorkshopId } from "@/lib/media/youtube";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_PATH = path.join(DATA_DIR, "content.json");

export type WorkshopLevel = 1 | 2 | 3;

export type WorkshopStep = {
  id: string;
  title: string;
  done: boolean;
  /** Solo admin / exportación; no se muestra en la web pública. */
  simbologia: string;
};

export type WorkshopMaterial = {
  id: string;
  title: string;
};

export type WorkshopItem = {
  id: string;
  title: string;
  text: string;
  image: string;
  youtubeUrl: string;
  duration: string;
  level: WorkshopLevel;
  coach: string;
  materials: WorkshopMaterial[];
  /** Paso a paso del taller (antes tasks). */
  steps: WorkshopStep[];
};

export type GalleryItem = {
  id: string;
  label: string;
  alt: string;
  image: string;
};

function normalizeWorkshopStep(
  step: Partial<WorkshopStep>,
  fallbackId: string,
): WorkshopStep {
  return {
    id: step.id || fallbackId,
    title: step.title || "",
    done: Boolean(step.done),
    simbologia: typeof step.simbologia === "string" ? step.simbologia : "",
  };
}

function normalizeWorkshopMaterial(
  material: Partial<WorkshopMaterial>,
  fallbackId: string,
): WorkshopMaterial {
  return {
    id: material.id || fallbackId,
    title: material.title || "",
  };
}

function normalizeLevel(value: unknown): WorkshopLevel {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 2 || n === 3) return n;
  return 1;
}

function normalizeWorkshop(
  workshop: Partial<WorkshopItem> & { tasks?: WorkshopStep[] },
  fallbackId: string,
): WorkshopItem {
  const rawSteps = Array.isArray(workshop.steps)
    ? workshop.steps
    : Array.isArray(workshop.tasks)
      ? workshop.tasks
      : [];
  const rawMaterials = Array.isArray(workshop.materials) ? workshop.materials : [];

  return {
    id: workshop.id || fallbackId,
    title: workshop.title || "",
    text: workshop.text || "",
    image: workshop.image || "",
    youtubeUrl: workshop.youtubeUrl || "",
    duration: workshop.duration || "",
    level: normalizeLevel(workshop.level),
    coach: workshop.coach || "",
    materials: rawMaterials.map((material, index) =>
      normalizeWorkshopMaterial(
        material as Partial<WorkshopMaterial>,
        `${fallbackId}-mat-${index}`,
      ),
    ),
    steps: rawSteps.map((step, index) =>
      normalizeWorkshopStep(step as Partial<WorkshopStep>, `${fallbackId}-step-${index}`),
    ),
  };
}

function normalizeGalleryItem(item: Partial<GalleryItem>, fallbackId: string): GalleryItem {
  return {
    id: item.id || fallbackId,
    label: item.label || "",
    alt: item.alt || "",
    image: item.image || "",
  };
}

function normalizeLocale(dict: Dictionary, locale: "en" | "es"): Dictionary {
  const defaults = dictionaries[locale].workshops;
  const next = structuredClone(dict) as Dictionary & {
    hero: Dictionary["hero"] & { videoUrl?: string };
  };

  if (!next.hero.videoUrl) {
    next.hero.videoUrl = "";
  }

  next.workshops.viewAll = next.workshops.viewAll || defaults.viewAll;
  next.workshops.allTitle = next.workshops.allTitle || defaults.allTitle;
  next.workshops.allBody = next.workshops.allBody || defaults.allBody;
  next.workshops.backHome = next.workshops.backHome || defaults.backHome;

  next.workshops.categories = next.workshops.categories.map((category, catIndex) => ({
    ...category,
    workshops: category.workshops.map((workshop, wIndex) =>
      normalizeWorkshop(
        workshop as Partial<WorkshopItem>,
        `${locale}-${catIndex}-${wIndex}`,
      ),
    ),
  }));

  next.gallery.items = next.gallery.items.map((item, index) =>
    normalizeGalleryItem(item as Partial<GalleryItem>, `${locale}-gallery-${index}`),
  );

  return next;
}

export function normalizeContent(content: SiteContent): SiteContent {
  const en = normalizeLocale(content.en, "en");
  const es = normalizeLocale(content.es, "es");

  if (en.hero.videoUrl && !es.hero.videoUrl) es.hero.videoUrl = en.hero.videoUrl;
  if (es.hero.videoUrl && !en.hero.videoUrl) en.hero.videoUrl = es.hero.videoUrl;
  if (en.hero.videoUrl !== es.hero.videoUrl) {
    es.hero.videoUrl = en.hero.videoUrl || es.hero.videoUrl;
  }

  en.workshops.categories.forEach((category, catIndex) => {
    const other = es.workshops.categories[catIndex];
    if (!other) return;
    category.workshops.forEach((workshop, wIndex) => {
      const pair = other.workshops[wIndex];
      if (!pair) return;
      if (pair.id !== workshop.id) pair.id = workshop.id;
      if (workshop.image && !pair.image) pair.image = workshop.image;
      if (pair.image && !workshop.image) workshop.image = pair.image;
      if (workshop.image !== pair.image) pair.image = workshop.image || pair.image;
      if (workshop.youtubeUrl && !pair.youtubeUrl) pair.youtubeUrl = workshop.youtubeUrl;
      if (pair.youtubeUrl && !workshop.youtubeUrl) workshop.youtubeUrl = pair.youtubeUrl;
      if (workshop.youtubeUrl !== pair.youtubeUrl) {
        pair.youtubeUrl = workshop.youtubeUrl || pair.youtubeUrl;
      }
      // Campos operativos compartidos (EN → ES).
      pair.duration = workshop.duration;
      pair.level = workshop.level;
      pair.coach = workshop.coach;
      pair.materials = workshop.materials.map((item) => ({ ...item }));
      pair.steps = workshop.steps.map((step) => ({ ...step }));
    });
  });

  en.gallery.items.forEach((item, index) => {
    const other = es.gallery.items[index];
    if (!other) return;
    other.id = item.id;
    if (item.image && !other.image) other.image = item.image;
    if (other.image && !item.image) item.image = other.image;
    if (item.image !== other.image) other.image = item.image || other.image;
  });

  return { en, es };
}

function cloneDefaults(): SiteContent {
  return normalizeContent(structuredClone(dictionaries) as SiteContent);
}

async function readContentLocal(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(CONTENT_PATH, "utf8");
    return normalizeContent(JSON.parse(raw) as SiteContent);
  } catch {
    return cloneDefaults();
  }
}

async function writeContentLocal(content: SiteContent) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONTENT_PATH, JSON.stringify(content, null, 2), "utf8");
}

async function readContentSupabase(): Promise<SiteContent> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_content")
    .select("content")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;
  if (!data?.content) return cloneDefaults();
  return normalizeContent(data.content as SiteContent);
}

async function writeContentSupabase(content: SiteContent) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("site_content").upsert({
    id: "main",
    content,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function readContent(): Promise<SiteContent> {
  if (isSupabaseConfigured()) {
    try {
      return await readContentSupabase();
    } catch (error) {
      console.error("Supabase content read failed, using local fallback:", error);
      return readContentLocal();
    }
  }
  return readContentLocal();
}

export async function writeContent(content: SiteContent) {
  const normalized = normalizeContent(content);

  if (isSupabaseConfigured()) {
    await writeContentSupabase(normalized);
    return;
  }

  await writeContentLocal(normalized);
}

export { createWorkshopId };
