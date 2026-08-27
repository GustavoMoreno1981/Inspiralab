import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAuthenticated } from "@/lib/auth/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const STORAGE_BUCKET = "uploads";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function extensionForType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "pdf";
}

async function uploadToLocal(name: string, buffer: Buffer) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

async function uploadToSupabase(name: string, buffer: Buffer, contentType: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(name, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "No se pudo guardar el archivo en Supabase Storage");
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(name);
  return data.publicUrl;
}

export async function POST(request: Request) {
  const ok = await isAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo no válido. Usa imagen o PDF." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo muy grande (máx 10MB)" }, { status: 400 });
  }

  const ext = extensionForType(file.type);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = isSupabaseConfigured()
      ? await uploadToSupabase(name, buffer, file.type)
      : await uploadToLocal(name, buffer);

    return NextResponse.json({ url, name: file.name || name });
  } catch (error) {
    console.error("upload failed:", error);
    const message =
      error instanceof Error ? error.message : "Error al subir archivo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
