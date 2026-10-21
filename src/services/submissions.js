import { connectDB } from "@/lib/db";
import { ApiError, isDuplicateKey } from "@/lib/errors";
import { toPublicForm } from "@/domain/public-form";
import { scoreRecruitment } from "@/domain/scoring";
import { validateIdempotencyKey, validateSubmission } from "@/domain/validators";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";
import DistributionLink from "@/models/DistributionLink";
import Candidate from "@/models/Candidate";
import Application from "@/models/Application";
import AnonymousResponse from "@/models/AnonymousResponse";

function availability(form, link, version, now = new Date()) {
  if (!form || !link || !version) {
    return { ok: false, message: "Este enlace no es válido." };
  }
  if (form.status !== "published" || !form.receptionOpen || !link.acceptingResponses) {
    return { ok: false, message: "Este formulario ya no recibe respuestas." };
  }
  if (version.opensAt && now < new Date(version.opensAt)) {
    return { ok: false, message: "Este formulario todavía no está disponible." };
  }
  if (version.closesAt && now > new Date(version.closesAt)) {
    return { ok: false, message: "El periodo de este formulario ya terminó." };
  }
  return { ok: true };
}

async function loadToken(token) {
  await connectDB();
  const link = await DistributionLink.findOne({ token });
  if (!link) return { link: null, form: null, version: null };
  const [form, version] = await Promise.all([
    Form.findById(link.formId),
    FormVersion.findById(link.formVersionId),
  ]);
  return { link, form, version };
}

export async function getPublicForm(token) {
  const { link, form, version } = await loadToken(token);
  if (!link || !form || !version) throw new ApiError(404, "NOT_FOUND", "Este enlace no es válido.");
  const state = availability(form, link, version);
  if (!state.ok) {
    return { available: false, message: state.message, title: version.title };
  }
  return { available: true, form: toPublicForm(version) };
}

async function replay(Model, idempotencyKey, link, confirmationMessage) {
  const existing = await Model.findOne({ idempotencyKey }).select("distributionLinkId");
  if (!existing) return null;
  if (String(existing.distributionLinkId) !== String(link._id)) {
    throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "La clave de idempotencia ya se usó en otra solicitud.");
  }
  return { ok: true, confirmationMessage, replay: true };
}

export async function submitPublicResponse({ token, body, idempotencyKey }) {
  const key = validateIdempotencyKey(idempotencyKey);
  if (!key) {
    throw new ApiError(400, "IDEMPOTENCY_KEY", "Incluye una clave de idempotencia válida para evitar un envío duplicado.");
  }
  const { link, form, version } = await loadToken(token);
  if (!link || !form || !version) throw new ApiError(404, "NOT_FOUND", "Este enlace no es válido.");
  const state = availability(form, link, version);
  if (!state.ok) throw new ApiError(409, "CLOSED", state.message);

  const parsed = validateSubmission(version, body);
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "Revisa las respuestas.", parsed.errors);

  if (version.modality === "climate") {
    const previous = await replay(AnonymousResponse, key, link, version.confirmationMessage);
    if (previous) return previous;
    try {
      await AnonymousResponse.create({
        formId: form._id,
        formVersionId: version._id,
        distributionLinkId: link._id,
        areaId: link.areaId || null,
        areaName: link.areaName || "",
        answers: parsed.value.answers,
        idempotencyKey: key,
        submittedAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKey(error, "idempotencyKey")) {
        const again = await replay(AnonymousResponse, key, link, version.confirmationMessage);
        if (again) return again;
      }
      throw error;
    }
    return { ok: true, confirmationMessage: version.confirmationMessage, replay: false };
  }

  const previous = await replay(Application, key, link, version.confirmationMessage);
  if (previous) return previous;

  let candidate = await Candidate.findOne({ email: parsed.value.email });
  if (!candidate) {
    try {
      candidate = await Candidate.create({ name: parsed.value.name, email: parsed.value.email });
    } catch (error) {
      if (!isDuplicateKey(error, "email")) throw error;
      candidate = await Candidate.findOne({ email: parsed.value.email });
    }
  } else if (candidate.name !== parsed.value.name) {
    candidate.name = parsed.value.name;
    await candidate.save();
  }

  const scoring = scoreRecruitment(version.questions, parsed.value.answers);
  try {
    await Application.create({
      candidateId: candidate._id,
      formId: form._id,
      formVersionId: version._id,
      distributionLinkId: link._id,
      answers: parsed.value.answers,
      scoring: {
        competencies: scoring.competencies,
        globalScore: scoring.globalScore,
      },
      reviewStatus: "pending",
      internalNotes: "",
      idempotencyKey: key,
      submittedAt: new Date(),
    });
  } catch (error) {
    if (isDuplicateKey(error, "idempotencyKey")) {
      const again = await replay(Application, key, link, version.confirmationMessage);
      if (again) return again;
    }
    throw error;
  }

  return { ok: true, confirmationMessage: version.confirmationMessage, replay: false };
}
