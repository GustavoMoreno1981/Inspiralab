import { promises as fs } from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type PrivateItemType = "activity" | "bank";

export type PrivateSecurityAnswers = {
  motherName: string;
  petName: string;
  birthYear: string;
};

export type PrivateAuthRecord = {
  itemType: PrivateItemType;
  itemId: string;
  pinHash: string;
  motherNameHash: string;
  petNameHash: string;
  birthYearHash: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_PATH = path.join(DATA_DIR, "private-item-auth.json");

function authKey(itemType: PrivateItemType, itemId: string) {
  return `${itemType}:${itemId}`;
}

/** Normaliza respuestas para comparación (minúsculas, sin tildes). */
export function normalizeSecurityAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeBirthYear(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 4) return digits;
  return normalizeSecurityAnswer(value);
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin.trim());
}

export function hashSecurityAnswer(value: string) {
  return hashPassword(normalizeSecurityAnswer(value));
}

export function hashBirthYear(value: string) {
  return hashPassword(normalizeBirthYear(value));
}

export function verifySecurityAnswer(value: string, stored: string) {
  return verifyPassword(normalizeSecurityAnswer(value), stored);
}

export function verifyBirthYear(value: string, stored: string) {
  return verifyPassword(normalizeBirthYear(value), stored);
}

type StoredAuthFile = Record<string, PrivateAuthRecord>;

async function readLocalAuth(): Promise<StoredAuthFile> {
  try {
    const raw = await fs.readFile(AUTH_PATH, "utf8");
    const data = JSON.parse(raw) as StoredAuthFile;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function writeLocalAuth(data: StoredAuthFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(AUTH_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function readAuthRecord(
  itemType: PrivateItemType,
  itemId: string,
): Promise<PrivateAuthRecord | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("private_item_auth")
      .select("*")
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      itemType,
      itemId,
      pinHash: data.pin_hash || "",
      motherNameHash: data.mother_name_hash || "",
      petNameHash: data.pet_name_hash || "",
      birthYearHash: data.birth_year_hash || "",
      updatedAt: data.updated_at || new Date().toISOString(),
    };
  }

  const all = await readLocalAuth();
  return all[authKey(itemType, itemId)] || null;
}

export async function savePrivateAuth(
  itemType: PrivateItemType,
  itemId: string,
  pin: string,
  answers: PrivateSecurityAnswers,
) {
  if (!isValidPin(pin)) {
    throw new Error("La clave debe tener exactamente 4 dígitos");
  }
  if (!answers.motherName.trim() || !answers.petName.trim() || !answers.birthYear.trim()) {
    throw new Error("Completa las tres preguntas de seguridad");
  }

  const record: PrivateAuthRecord = {
    itemType,
    itemId,
    pinHash: hashPassword(pin.trim()),
    motherNameHash: hashSecurityAnswer(answers.motherName),
    petNameHash: hashSecurityAnswer(answers.petName),
    birthYearHash: hashBirthYear(answers.birthYear),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("private_item_auth").upsert({
      item_type: itemType,
      item_id: itemId,
      pin_hash: record.pinHash,
      mother_name_hash: record.motherNameHash,
      pet_name_hash: record.petNameHash,
      birth_year_hash: record.birthYearHash,
      updated_at: record.updatedAt,
    });
    if (error) throw error;
    return;
  }

  const all = await readLocalAuth();
  all[authKey(itemType, itemId)] = record;
  await writeLocalAuth(all);
}

export async function deletePrivateAuth(itemType: PrivateItemType, itemId: string) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("private_item_auth")
      .delete()
      .eq("item_type", itemType)
      .eq("item_id", itemId);
    return;
  }

  const all = await readLocalAuth();
  delete all[authKey(itemType, itemId)];
  await writeLocalAuth(all);
}

export async function verifyPrivatePin(
  itemType: PrivateItemType,
  itemId: string,
  pin: string,
) {
  const record = await readAuthRecord(itemType, itemId);
  if (!record?.pinHash) return false;
  return verifyPassword(pin.trim(), record.pinHash);
}

export async function verifyPrivateRecovery(
  itemType: PrivateItemType,
  itemId: string,
  answers: PrivateSecurityAnswers,
) {
  const record = await readAuthRecord(itemType, itemId);
  if (!record) return false;
  return (
    verifySecurityAnswer(answers.motherName, record.motherNameHash) &&
    verifySecurityAnswer(answers.petName, record.petNameHash) &&
    verifyBirthYear(answers.birthYear, record.birthYearHash)
  );
}

export async function resetPrivatePin(
  itemType: PrivateItemType,
  itemId: string,
  answers: PrivateSecurityAnswers,
  newPin: string,
) {
  const ok = await verifyPrivateRecovery(itemType, itemId, answers);
  if (!ok) return false;
  await savePrivateAuth(itemType, itemId, newPin, answers);
  return true;
}

export async function copyPrivateAuth(
  fromType: PrivateItemType,
  fromId: string,
  toType: PrivateItemType,
  toId: string,
) {
  const record = await readAuthRecord(fromType, fromId);
  if (!record) return false;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("private_item_auth").upsert({
      item_type: toType,
      item_id: toId,
      pin_hash: record.pinHash,
      mother_name_hash: record.motherNameHash,
      pet_name_hash: record.petNameHash,
      birth_year_hash: record.birthYearHash,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return true;
  }

  const all = await readLocalAuth();
  all[authKey(toType, toId)] = {
    ...record,
    itemType: toType,
    itemId: toId,
    updatedAt: new Date().toISOString(),
  };
  await writeLocalAuth(all);
  return true;
}
