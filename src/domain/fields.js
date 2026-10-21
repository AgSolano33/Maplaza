import { LIMITS } from "./constants.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCKED = new Set(["email", "phone", "number", "date", "time", "url"]);

export function isLockedField(type) {
  return LOCKED.has(type);
}

export function restrictInput(type, value) {
  const raw = String(value ?? "");
  if (type === "phone") return raw.replace(/[^\d+\-()\s]/g, "").slice(0, 20);
  if (type === "number") return restrictNumber(raw);
  if (type === "email") return raw.replace(/\s/g, "").slice(0, LIMITS.email);
  if (type === "date") return raw.slice(0, 10);
  if (type === "time") return raw.replace(/[^\d:]/g, "").slice(0, 5);
  if (type === "url") return raw.replace(/\s/g, "").slice(0, LIMITS.short);
  if (type === "long_text") return raw.slice(0, LIMITS.long);
  return raw.slice(0, LIMITS.short);
}

export function fieldError(type, value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (type === "email") {
    const email = text.toLowerCase();
    if (!EMAIL.test(email) || email.length > LIMITS.email) return "Escribe un correo válido.";
  }
  if (type === "phone") {
    const digits = text.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return "Escribe un teléfono de 8 a 15 dígitos.";
  }
  if (type === "number") {
    if (!/^-?\d+(\.\d+)?$/.test(text.replace(",", "."))) return "Escribe solo un número.";
  }
  if (type === "date" && !isCalendarDate(text)) return "Elige una fecha válida.";
  if (type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return "Elige una hora válida.";
  if (type === "url" && !isWebUrl(text)) return "Escribe un enlace que empiece por https://.";
  return "";
}

export function storedFieldText(type, value) {
  const text = restrictInput(type, value).trim();
  if (type === "email") return text.toLowerCase();
  if (type === "number") return text.replace(",", ".");
  return text;
}

function restrictNumber(raw) {
  let next = raw.replace(",", ".").replace(/[^\d.-]/g, "");
  const negative = next.startsWith("-");
  next = next.replace(/-/g, "");
  const parts = next.split(".");
  const whole = parts[0].slice(0, 12);
  const fraction = parts.length > 1 ? parts.slice(1).join("").slice(0, 6) : "";
  const body = parts.length > 1 ? `${whole}.${fraction}` : whole;
  return `${negative ? "-" : ""}${body}`.slice(0, 20);
}

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
