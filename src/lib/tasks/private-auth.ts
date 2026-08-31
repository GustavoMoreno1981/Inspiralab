import { promises as fs } from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  LEGACY_SECURITY_QUESTION_KEYS,
  SECURITY_QUESTION_KEYS,
  emptyPrivateSecurityAnswers,
  type PrivateSecurityAnswers,
  type SecurityQuestionKey,
  isSecurityQuestionKey,
} from "@/lib/tasks/security-questions";

export type PrivateItemType = "activity" | "bank";

export type PrivateSecuritySetup = {
  questionKeys: SecurityQuestionKey[];
  answers: PrivateSecurityAnswers;
};

export type PrivateAuthRecord = {
  itemType: PrivateItemType;
  itemId: string;
  pinHash: string;
  motherNameHash: string;
  petNameHash: string;
  birthYearHash: string;
  ageHash: string;
  spouseNameHash: string;
  schoolNameHash: string;
  securityQuestionKeys: SecurityQuestionKey[];
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_PATH = path.join(DATA_DIR, "private-item-auth.json");

function authKey(itemType: PrivateItemType, itemId: string) {
  return `${itemType}:${itemId}`;
}

export { emptyPrivateSecurityAnswers } from "@/lib/tasks/security-questions";
export type { PrivateSecurityAnswers } from "@/lib/tasks/security-questions";

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

export function normalizeAge(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || normalizeSecurityAnswer(value);
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

export function hashAge(value: string) {
  return hashPassword(normalizeAge(value));
}

export function verifySecurityAnswer(value: string, stored: string) {
  if (!stored) return false;
  return verifyPassword(normalizeSecurityAnswer(value), stored);
}

export function verifyBirthYear(value: string, stored: string) {
  if (!stored) return false;
  return verifyPassword(normalizeBirthYear(value), stored);
}

export function verifyAge(value: string, stored: string) {
  if (!stored) return false;
  return verifyPassword(normalizeAge(value), stored);
}

function hashAnswerForKey(key: SecurityQuestionKey, value: string) {
  if (key === "birthYear") return hashBirthYear(value);
  if (key === "age") return hashAge(value);
  return hashSecurityAnswer(value);
}

function verifyAnswerForKey(key: SecurityQuestionKey, value: string, stored: string) {
  if (key === "birthYear") return verifyBirthYear(value, stored);
  if (key === "age") return verifyAge(value, stored);
  return verifySecurityAnswer(value, stored);
}

function getHashForKey(record: PrivateAuthRecord, key: SecurityQuestionKey) {
  switch (key) {
    case "motherName":
      return record.motherNameHash;
    case "petName":
      return record.petNameHash;
    case "birthYear":
      return record.birthYearHash;
    case "age":
      return record.ageHash;
    case "spouseName":
      return record.spouseNameHash;
    case "schoolName":
      return record.schoolNameHash;
    default:
      return "";
  }
}

function setHashForKey(
  record: PrivateAuthRecord,
  key: SecurityQuestionKey,
  hash: string,
) {
  switch (key) {
    case "motherName":
      record.motherNameHash = hash;
      break;
    case "petName":
      record.petNameHash = hash;
      break;
    case "birthYear":
      record.birthYearHash = hash;
      break;
    case "age":
      record.ageHash = hash;
      break;
    case "spouseName":
      record.spouseNameHash = hash;
      break;
    case "schoolName":
      record.schoolNameHash = hash;
      break;
    default:
      break;
  }
}

export function getConfiguredSecurityQuestionKeys(
  record: PrivateAuthRecord | null,
): SecurityQuestionKey[] {
  if (!record) return [...LEGACY_SECURITY_QUESTION_KEYS];
  if (record.securityQuestionKeys.length) return [...record.securityQuestionKeys];
  return [...LEGACY_SECURITY_QUESTION_KEYS];
}

export function validateSecuritySetup(input: {
  questionKeys: SecurityQuestionKey[];
  answers: PrivateSecurityAnswers;
}) {
  const keys = input.questionKeys.filter(isSecurityQuestionKey);
  if (keys.length !== 1) {
    throw new Error("Debes responder la pregunta de seguridad");
  }
  for (const key of keys) {
    const value = input.answers[key]?.trim() || "";
    if (!value) {
      throw new Error("Completa la pregunta de seguridad");
    }
    if (key === "birthYear" && !/^\d{4}$/.test(value)) {
      throw new Error("Indica el año de nacimiento con 4 dígitos");
    }
    if (key === "age" && !/^\d{1,3}$/.test(value.replace(/\D/g, ""))) {
      throw new Error("Indica tu edad en años");
    }
  }
}

type StoredAuthFile = Record<string, PrivateAuthRecord>;

function mapDbRow(
  itemType: PrivateItemType,
  itemId: string,
  data: Record<string, unknown>,
): PrivateAuthRecord {
  const rawKeys = Array.isArray(data.security_question_keys)
    ? data.security_question_keys.filter(
        (key): key is SecurityQuestionKey =>
          typeof key === "string" && isSecurityQuestionKey(key),
      )
    : [];

  return {
    itemType,
    itemId,
    pinHash: String(data.pin_hash || ""),
    motherNameHash: String(data.mother_name_hash || ""),
    petNameHash: String(data.pet_name_hash || ""),
    birthYearHash: String(data.birth_year_hash || ""),
    ageHash: String(data.age_hash || ""),
    spouseNameHash: String(data.spouse_name_hash || ""),
    schoolNameHash: String(data.school_name_hash || ""),
    securityQuestionKeys: rawKeys,
    updatedAt: String(data.updated_at || new Date().toISOString()),
  };
}

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
    return mapDbRow(itemType, itemId, data as Record<string, unknown>);
  }

  const all = await readLocalAuth();
  return all[authKey(itemType, itemId)] || null;
}

export async function getPrivateSecurityQuestionKeys(
  itemType: PrivateItemType,
  itemId: string,
): Promise<SecurityQuestionKey[]> {
  const record = await readAuthRecord(itemType, itemId);
  const configured = getConfiguredSecurityQuestionKeys(record);
  if (configured.length === 1) return configured;
  // Compatibilidad: ítems antiguos con 3 preguntas → recuperar con la primera guardada.
  if (configured.length > 1) return [configured[0]];
  return configured;
}

function buildAuthRecord(
  itemType: PrivateItemType,
  itemId: string,
  pin: string,
  setup: PrivateSecuritySetup,
): PrivateAuthRecord {
  validateSecuritySetup(setup);

  const record: PrivateAuthRecord = {
    itemType,
    itemId,
    pinHash: hashPassword(pin.trim()),
    motherNameHash: "",
    petNameHash: "",
    birthYearHash: "",
    ageHash: "",
    spouseNameHash: "",
    schoolNameHash: "",
    securityQuestionKeys: [...setup.questionKeys],
    updatedAt: new Date().toISOString(),
  };

  for (const key of setup.questionKeys) {
    setHashForKey(record, key, hashAnswerForKey(key, setup.answers[key]));
  }

  return record;
}

async function persistAuthRecord(record: PrivateAuthRecord) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("private_item_auth").upsert({
      item_type: record.itemType,
      item_id: record.itemId,
      pin_hash: record.pinHash,
      mother_name_hash: record.motherNameHash,
      pet_name_hash: record.petNameHash,
      birth_year_hash: record.birthYearHash,
      age_hash: record.ageHash,
      spouse_name_hash: record.spouseNameHash,
      school_name_hash: record.schoolNameHash,
      security_question_keys: record.securityQuestionKeys,
      updated_at: record.updatedAt,
    });
    if (error) throw error;
    return;
  }

  const all = await readLocalAuth();
  all[authKey(record.itemType, record.itemId)] = record;
  await writeLocalAuth(all);
}

export async function savePrivateAuth(
  itemType: PrivateItemType,
  itemId: string,
  pin: string,
  setup: PrivateSecuritySetup,
) {
  if (!isValidPin(pin)) {
    throw new Error("La clave debe tener exactamente 4 dígitos");
  }

  const record = buildAuthRecord(itemType, itemId, pin, setup);
  await persistAuthRecord(record);
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
  questionKeys: SecurityQuestionKey[],
  answers: PrivateSecurityAnswers,
) {
  const record = await readAuthRecord(itemType, itemId);
  if (!record) return false;

  const configured = new Set(getConfiguredSecurityQuestionKeys(record));
  const keys = questionKeys.filter((key) => configured.has(key));
  if (keys.length !== questionKeys.length || keys.length !== 1) return false;

  return keys.every((key) =>
    verifyAnswerForKey(key, answers[key] || "", getHashForKey(record, key)),
  );
}

export async function resetPrivatePin(
  itemType: PrivateItemType,
  itemId: string,
  questionKeys: SecurityQuestionKey[],
  answers: PrivateSecurityAnswers,
  newPin: string,
) {
  const ok = await verifyPrivateRecovery(itemType, itemId, questionKeys, answers);
  if (!ok) return false;

  const record = await readAuthRecord(itemType, itemId);
  if (!record) return false;

  if (!isValidPin(newPin)) {
    throw new Error("La clave debe tener exactamente 4 dígitos");
  }

  record.pinHash = hashPassword(newPin.trim());
  record.updatedAt = new Date().toISOString();
  await persistAuthRecord(record);
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

  const copy: PrivateAuthRecord = {
    ...record,
    itemType: toType,
    itemId: toId,
    updatedAt: new Date().toISOString(),
  };
  await persistAuthRecord(copy);
  return true;
}

export { SECURITY_QUESTION_KEYS };
