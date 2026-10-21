import { ApiError } from "./errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originHost(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin) return { origin: "", host };
  try {
    return { origin: new URL(origin).host, host };
  } catch {
    throw new ApiError(403, "CSRF", "El origen de la solicitud no es válido.");
  }
}

export function assertSameOrigin(request) {
  if (SAFE_METHODS.has(request.method)) return;
  const parsed = originHost(request);
  if (!parsed.origin || !parsed.host || parsed.origin !== parsed.host) {
    throw new ApiError(403, "CSRF", "La solicitud no supera la verificación de origen.");
  }
}

export function assertPublicOrigin(request) {
  const parsed = originHost(request);
  if (parsed.origin && parsed.host && parsed.origin !== parsed.host) {
    throw new ApiError(403, "CSRF", "La solicitud no supera la verificación de origen.");
  }
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "local";
}

export async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 150_000) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "La solicitud es demasiado grande.");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "El cuerpo de la solicitud no es JSON válido.");
  }
}

export function pageParams(url) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function publicOrigin(request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function api(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json(
          { error: { code: error.code, message: error.message, fields: error.fields } },
          { status: error.status },
        );
      }
      console.error(error instanceof Error ? error.message : "Error interno");
      return Response.json(
        { error: { code: "INTERNAL", message: "Ocurrió un error interno." } },
        { status: 500 },
      );
    }
  };
}
