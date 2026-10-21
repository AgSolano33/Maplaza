import { randomBytes, randomUUID } from "node:crypto";

export function newId() {
  return randomUUID();
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function isObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

export function isStableId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value);
}
