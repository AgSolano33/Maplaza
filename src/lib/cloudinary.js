import { createHash } from "node:crypto";
import { ApiError } from "./errors.js";
import { matchesCloudinaryAccount } from "@/domain/images";

export async function uploadFormImage(bytes) {
  const cloud = process.env.cloudinary_name || "";
  const key = process.env.cloudinary_api_key || "";
  const secret = process.env.cloudinary_api_secret || "";
  if (!cloud || !key || !secret) {
    throw new ApiError(500, "UPLOAD_UNAVAILABLE", "El almacenamiento de imágenes no está configurado.");
  }
  const folder = "maplasa/forms";
  const timestamp = Math.round(Date.now() / 1000);
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  const body = new FormData();
  body.append("file", new Blob([bytes], { type: "image/jpeg" }), "imagen.jpg");
  body.append("api_key", key);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);
  body.append("folder", folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
    method: "POST",
    body,
  });
  const data = await response.json().catch(() => null);
  const url = data?.secure_url || "";
  if (!response.ok || !matchesCloudinaryAccount(url, cloud)) {
    throw new ApiError(502, "UPLOAD_FAILED", "No se pudo guardar la imagen.");
  }
  return url;
}
