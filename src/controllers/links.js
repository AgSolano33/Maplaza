import QRCode from "qrcode";
import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { isObjectId, newToken } from "@/domain/ids";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";
import DistributionLink from "@/models/DistributionLink";
import Area from "@/models/Area";

export async function createLink(user, formId, input, origin) {
  await connectDB();
  const form = await Form.findById(formId);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status === "archived") throw new ApiError(409, "ARCHIVED", "No se pueden crear enlaces de un formulario archivado.");
  const version = await FormVersion.findOne({
    _id: input?.versionId,
    formId: form._id,
  });
  if (!version) throw new ApiError(422, "VALIDATION", "Elige una versión publicada.", { versionId: "La versión no pertenece a este formulario." });

  let areaId = null;
  let areaName = "";
  if (form.modality === "recruitment" && input?.areaId) {
    throw new ApiError(422, "VALIDATION", "El reclutamiento no usa enlaces por área.", { areaId: "Deja el área vacía." });
  }
  if (input?.areaId) {
    if (!isObjectId(input.areaId)) throw new ApiError(422, "VALIDATION", "El área no es válida.", { areaId: "Elige un área del catálogo." });
    const area = await Area.findById(input.areaId);
    if (!area || !area.active) throw new ApiError(422, "VALIDATION", "El área no está disponible.", { areaId: "Elige un área activa." });
    areaId = area._id;
    areaName = area.name;
  }

  const link = await DistributionLink.create({
    token: newToken(),
    formId: form._id,
    formVersionId: version._id,
    areaId,
    areaName,
    acceptingResponses: true,
    createdBy: user._id,
  });

  return {
    id: String(link._id),
    token: link.token,
    url: `${origin}/f/${link.token}`,
    versionId: String(version._id),
    versionNumber: version.versionNumber,
    areaId: areaId ? String(areaId) : "",
    areaName,
    acceptingResponses: true,
  };
}

export async function setLinkReception(id, acceptingResponses) {
  await connectDB();
  const link = await DistributionLink.findById(id);
  if (!link) throw new ApiError(404, "NOT_FOUND", "No se encontró el enlace.");
  link.acceptingResponses = Boolean(acceptingResponses);
  await link.save();
  return {
    id: String(link._id),
    acceptingResponses: link.acceptingResponses,
    formVersionId: String(link.formVersionId),
  };
}

export async function qrForLink(id, origin) {
  await connectDB();
  const link = await DistributionLink.findById(id);
  if (!link) throw new ApiError(404, "NOT_FOUND", "No se encontró el enlace.");
  const url = `${origin}/f/${link.token}`;
  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return { png, filename: `maplasa-${link.areaName || "enlace"}.png`.replace(/[^\w.-]+/g, "-") };
}
