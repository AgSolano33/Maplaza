import { ApiError } from "./errors.js";

const buckets = new Map();

export function assertRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    throw new ApiError(429, "RATE_LIMIT", "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.");
  }
  recent.push(now);
  buckets.set(key, recent);
}

export function resetRateLimit() {
  buckets.clear();
}
