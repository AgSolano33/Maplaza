import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { newId, newToken } from "@/domain/ids";
import { normalizeDraft } from "@/domain/validators";
import { toPublicForm } from "@/domain/public-form";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";
import DistributionLink from "@/models/DistributionLink";
import Competency from "@/models/Competency";

function serializeQuestion(question) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt || "",
    required: Boolean(question.required),
    competencyId: question.competencyId ? String(question.competencyId) : "",
    competencyName: question.competencyName || "",
    scored: Boolean(question.scored),
    options: (question.options || []).map((option) => ({
      id: option.id,
      label: option.label || "",
      ...(typeof option.score === "number" ? { score: option.score } : {}),
    })),
    scaleLabels: question.scaleLabels || [],
  };
}

function signature(data) {
  return JSON.stringify({
    title: data.title,
    description: data.description || "",
    targetRole: data.targetRole || "",
    instructions: data.instructions || "",
    confirmationMessage: data.confirmationMessage || "",
    opensAt: data.opensAt ? new Date(data.opensAt).toISOString() : null,
    closesAt: data.closesAt ? new Date(data.closesAt).toISOString() : null,
    appearance: serializeAppearance(data.appearance),
    questions: (data.questions || []).map((question) => {
      const item = serializeQuestion(question);
      delete item.competencyName;
      return item;
    }),
  });
}

export function serializeForm(form, extras = {}) {
  return {
    id: String(form._id),
    title: form.title,
    description: form.description || "",
    modality: form.modality,
    targetRole: form.targetRole || "",
    instructions: form.instructions || "",
    confirmationMessage: form.confirmationMessage || "",
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    appearance: serializeAppearance(form.appearance),
    status: form.status,
    publishedVersion: form.publishedVersion || 0,
    hasUnpublishedChanges: Boolean(form.hasUnpublishedChanges),
    questionCount: form.questions?.length || 0,
    questions: (form.questions || []).map(serializeQuestion),
    updatedAt: form.updatedAt,
    ...extras,
  };
}

function applyDraft(form, value) {
  form.title = value.title;
  form.description = value.description;
  form.modality = value.modality;
  form.targetRole = value.targetRole;
  form.instructions = value.instructions;
  form.confirmationMessage = value.confirmationMessage;
  form.opensAt = value.opensAt;
  form.closesAt = value.closesAt;
  form.questions = value.questions;
  form.appearance = value.appearance;
}

function serializeAppearance(appearance) {
  return {
    primaryColor: appearance?.primaryColor || "#315ce8",
    logo: appearance?.logo || "",
    cover: appearance?.cover || "",
  };
}

async function hydrateCompetencies(questions) {
  const ids = [...new Set(questions.map((question) => question.competencyId).filter(Boolean))];
  const competencies = ids.length ? await Competency.find({ _id: { $in: ids } }) : [];
  const byId = new Map(competencies.map((item) => [String(item._id), item]));
  return questions.map((question) => {
    if (!question.competencyId) return { ...question, competencyName: "" };
    const competency = byId.get(String(question.competencyId));
    if (!competency) {
      throw new ApiError(422, "VALIDATION", "Hay una competencia que ya no existe.", {
        competencyId: "Selecciona una competencia del catálogo.",
      });
    }
    return { ...question, competencyName: competency.name };
  });
}

export async function listForms(url, origin = "") {
  await connectDB();
  const modality = url.searchParams.get("modality");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const filter = {};
  if (modality === "recruitment" || modality === "climate") filter.modality = modality;
  if (["draft", "published", "closed", "archived"].includes(status)) filter.status = status;
  if (q) filter.title = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [items, total] = await Promise.all([
    Form.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Form.countDocuments(filter),
  ]);
  const ids = items.map((form) => form._id);
  const links = ids.length ? await DistributionLink.find({ formId: { $in: ids } }).sort({ createdAt: -1 }) : [];
  const versionIds = [...new Set(links.map((link) => String(link.formVersionId)))];
  const versions = versionIds.length ? await FormVersion.find({ _id: { $in: versionIds } }).select("versionNumber") : [];
  const versionNumberById = new Map(versions.map((version) => [String(version._id), version.versionNumber]));
  const linksByForm = new Map();
  for (const link of links) {
    const key = String(link.formId);
    if (!linksByForm.has(key)) linksByForm.set(key, []);
    linksByForm.get(key).push({
      id: String(link._id),
      url: `${origin}/f/${link.token}`,
      versionNumber: versionNumberById.get(String(link.formVersionId)) || null,
      areaName: link.areaName || "",
      acceptingResponses: link.acceptingResponses,
    });
  }
  return {
    items: items.map((form) => serializeForm(form, {
      questions: undefined,
      links: linksByForm.get(String(form._id)) || [],
    })),
    page,
    limit,
    total,
  };
}

export async function createForm(user, input) {
  await connectDB();
  const parsed = normalizeDraft(input, { strict: false });
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "Revisa el formulario.", parsed.errors);
  const form = await Form.create({
    ...parsed.value,
    status: "draft",
    publishedVersion: 0,
    hasUnpublishedChanges: true,
    receptionOpen: false,
    createdBy: user._id,
  });
  return serializeForm(form);
}

export async function getForm(id, origin) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  const [versions, links] = await Promise.all([
    FormVersion.find({ formId: form._id }).sort({ versionNumber: -1 }),
    DistributionLink.find({ formId: form._id }).sort({ createdAt: -1 }),
  ]);
  const versionNumberById = new Map(versions.map((version) => [String(version._id), version.versionNumber]));
  return serializeForm(form, {
    versions: versions.map((version) => ({
      id: String(version._id),
      versionNumber: version.versionNumber,
      title: version.title,
      publishedAt: version.publishedAt,
      questionCount: version.questions.length,
    })),
    links: links.map((link) => ({
      id: String(link._id),
      token: link.token,
      url: `${origin}/f/${link.token}`,
      versionId: String(link.formVersionId),
      versionNumber: versionNumberById.get(String(link.formVersionId)) || null,
      areaId: link.areaId ? String(link.areaId) : "",
      areaName: link.areaName || "",
      acceptingResponses: link.acceptingResponses,
    })),
  });
}

export async function updateForm(id, input) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status === "archived") {
    throw new ApiError(409, "ARCHIVED", "Restaura el formulario antes de editarlo.");
  }
  if (form.publishedVersion > 0 && input?.modality && input.modality !== form.modality) {
    throw new ApiError(409, "MODALITY_LOCKED", "La modalidad no puede cambiar después de publicar.");
  }
  const parsed = normalizeDraft({ ...input, modality: form.publishedVersion > 0 ? form.modality : input?.modality }, { strict: false });
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "Revisa el formulario.", parsed.errors);
  applyDraft(form, parsed.value);
  if (form.publishedVersion > 0) {
    const current = await FormVersion.findOne({ formId: form._id, versionNumber: form.publishedVersion });
    form.hasUnpublishedChanges = !current || signature(form) !== signature(current);
  } else {
    form.hasUnpublishedChanges = true;
  }
  await form.save();
  return serializeForm(form);
}

export async function publishForm(user, id) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status === "archived") throw new ApiError(409, "ARCHIVED", "Restaura el formulario antes de publicar.");
  const parsed = normalizeDraft(
    {
      title: form.title,
      description: form.description,
      modality: form.modality,
      targetRole: form.targetRole,
      instructions: form.instructions,
      confirmationMessage: form.confirmationMessage,
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      appearance: serializeAppearance(form.appearance),
      questions: form.questions.map(serializeQuestion),
    },
    { strict: true },
  );
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "El formulario todavía no se puede publicar.", parsed.errors);
  if (form.publishedVersion > 0 && !form.hasUnpublishedChanges) {
    throw new ApiError(409, "NO_CHANGES", "No hay cambios nuevos para publicar. Los enlaces actuales siguen en su versión.");
  }
  const questions = await hydrateCompetencies(parsed.value.questions);
  applyDraft(form, { ...parsed.value, questions });
  const version = await FormVersion.create({
    formId: form._id,
    versionNumber: form.publishedVersion + 1,
    title: form.title,
    description: form.description,
    modality: form.modality,
    targetRole: form.targetRole,
    instructions: form.instructions,
    confirmationMessage: form.confirmationMessage,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    appearance: serializeAppearance(form.appearance),
    questions,
    publishedAt: new Date(),
    publishedBy: user._id,
  });
  form.publishedVersion = version.versionNumber;
  form.status = "published";
  form.receptionOpen = true;
  form.hasUnpublishedChanges = false;
  await form.save();

  let link = null;
  if (version.versionNumber === 1) {
    link = await DistributionLink.create({
      token: newToken(),
      formId: form._id,
      formVersionId: version._id,
      areaId: null,
      areaName: "",
      acceptingResponses: true,
      createdBy: user._id,
    });
  }

  return {
    form: serializeForm(form),
    version: { id: String(version._id), versionNumber: version.versionNumber },
    link: link ? { id: String(link._id), token: link.token } : null,
  };
}

export async function duplicateForm(user, id) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  const copy = await Form.create({
    title: `${form.title} (copia)`.slice(0, 140),
    description: form.description,
    modality: form.modality,
    targetRole: form.targetRole,
    instructions: form.instructions,
    confirmationMessage: form.confirmationMessage,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    appearance: serializeAppearance(form.appearance),
    status: "draft",
    questions: form.questions.map((question) => ({
      ...serializeQuestion(question),
      id: newId(),
      competencyId: question.competencyId || null,
      options: (question.options || []).map((option) => ({
        id: newId(),
        label: option.label,
        ...(typeof option.score === "number" ? { score: option.score } : {}),
      })),
    })),
    publishedVersion: 0,
    hasUnpublishedChanges: true,
    receptionOpen: false,
    createdBy: user._id,
  });
  return serializeForm(copy);
}

export async function closeForm(id) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status !== "published") {
    throw new ApiError(409, "INVALID_STATE", "Solo un formulario publicado puede cerrar su recepción.");
  }
  form.status = "closed";
  form.receptionOpen = false;
  await form.save();
  return serializeForm(form);
}

export async function reopenForm(id) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status !== "closed" || !form.publishedVersion) {
    throw new ApiError(409, "INVALID_STATE", "Solo un formulario cerrado puede reabrir la recepción.");
  }
  form.status = "published";
  form.receptionOpen = true;
  await form.save();
  return serializeForm(form);
}

export async function archiveForm(id) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status === "archived") throw new ApiError(409, "ARCHIVED", "El formulario ya está archivado.");
  form.status = "archived";
  form.receptionOpen = false;
  await form.save();
  return serializeForm(form);
}

export async function restoreForm(id) {
  await connectDB();
  const form = await Form.findById(id);
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  if (form.status !== "archived") throw new ApiError(409, "INVALID_STATE", "El formulario no está archivado.");
  form.status = form.publishedVersion > 0 ? "closed" : "draft";
  form.receptionOpen = false;
  await form.save();
  return serializeForm(form);
}

export function previewForm(input) {
  const parsed = normalizeDraft(input, { strict: false });
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "Revisa el formulario antes de previsualizar.", parsed.errors);
  return { form: toPublicForm(parsed.value) };
}
