import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { uploadFormImage } from "@/lib/cloudinary";
import { ApiError } from "@/lib/errors";

const MAX_BYTES = 2_000_000;

export const POST = api(async (request) => {
  await requireAdmin(request);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "INVALID_IMAGE", "Selecciona una imagen.");
  }
  if (file.type !== "image/jpeg" || file.size < 1 || file.size > MAX_BYTES) {
    throw new ApiError(400, "INVALID_IMAGE", "Confirma un recorte JPG más pequeño.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new ApiError(400, "INVALID_IMAGE", "La imagen recortada no es válida.");
  }
  return json({ url: await uploadFormImage(bytes) });
});
