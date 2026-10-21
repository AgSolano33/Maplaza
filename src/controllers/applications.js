import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { LIMITS, REVIEW_LABELS } from "@/domain/constants";
import { parseDay } from "@/domain/dates";
import { formatScore } from "@/domain/scoring";
import { toCsv } from "@/domain/csv";
import { pageParams } from "@/lib/http";
import Candidate from "@/models/Candidate";
import Application from "@/models/Application";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildFilter(url) {
  const filter = {};
  const status = url.searchParams.get("status");
  const formId = url.searchParams.get("formId");
  const q = (url.searchParams.get("q") || "").trim();
  const from = parseDay(url.searchParams.get("from") || "");
  const to = parseDay(url.searchParams.get("to") || "", true);
  if (["pending", "interview", "hired", "rejected"].includes(status)) filter.reviewStatus = status;
  if (formId) filter.formId = formId;
  if (from || to) {
    filter.submittedAt = {};
    if (from) filter.submittedAt.$gte = from;
    if (to) filter.submittedAt.$lte = to;
  }
  if (q) {
    const candidates = await Candidate.find({
      $or: [{ name: new RegExp(escapeRegex(q), "i") }, { email: new RegExp(escapeRegex(q), "i") }],
    }).select("_id");
    filter.candidateId = { $in: candidates.map((candidate) => candidate._id) };
  }
  return filter;
}

function serializeRow(application, candidate, form, version) {
  return {
    id: String(application._id),
    candidateId: candidate ? String(candidate._id) : "",
    name: candidate?.name || "Candidato",
    email: candidate?.email || "",
    formId: form ? String(form._id) : "",
    formTitle: form?.title || version?.title || "Evaluación",
    versionNumber: version?.versionNumber || null,
    globalScore: application.scoring?.globalScore ?? null,
    globalScoreLabel: formatScore(application.scoring?.globalScore),
    reviewStatus: application.reviewStatus,
    reviewLabel: REVIEW_LABELS[application.reviewStatus] || application.reviewStatus,
    submittedAt: application.submittedAt,
  };
}

async function loadContext(applications) {
  const candidateIds = [...new Set(applications.map((item) => String(item.candidateId)))];
  const formIds = [...new Set(applications.map((item) => String(item.formId)))];
  const versionIds = [...new Set(applications.map((item) => String(item.formVersionId)))];
  const [candidates, forms, versions] = await Promise.all([
    Candidate.find({ _id: { $in: candidateIds } }),
    Form.find({ _id: { $in: formIds } }).select("title"),
    FormVersion.find({ _id: { $in: versionIds } }).select("title versionNumber questions"),
  ]);
  return {
    candidates: new Map(candidates.map((item) => [String(item._id), item])),
    forms: new Map(forms.map((item) => [String(item._id), item])),
    versions: new Map(versions.map((item) => [String(item._id), item])),
  };
}

export async function listApplications(url) {
  await connectDB();
  const filter = await buildFilter(url);
  const { page, limit, skip } = pageParams(url);
  const [applications, total] = await Promise.all([
    Application.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit),
    Application.countDocuments(filter),
  ]);
  const context = await loadContext(applications);
  return {
    items: applications.map((application) =>
      serializeRow(
        application,
        context.candidates.get(String(application.candidateId)),
        context.forms.get(String(application.formId)),
        context.versions.get(String(application.formVersionId)),
      ),
    ),
    page,
    limit,
    total,
  };
}

function answerView(question, answer) {
  if (!answer) return { prompt: question.prompt, value: "Sin respuesta" };
  if (question.type === "single" || question.type === "dropdown") {
    const option = (question.options || []).find((item) => item.id === answer.optionId);
    const view = { prompt: question.prompt, value: option?.label || "Opción no disponible" };
    if (question.type === "single") {
      view.points = typeof option?.score === "number" ? option.score : null;
      view.competencyName = question.competencyName || "";
    }
    return view;
  }
  if (question.type === "multiple") {
    const labels = (question.options || [])
      .filter((item) => (answer.optionIds || []).includes(item.id))
      .map((item) => item.label);
    return { prompt: question.prompt, value: labels.length ? labels.join(", ") : "Opción no disponible" };
  }
  if (question.type === "scale" || question.type === "rating") {
    return { prompt: question.prompt, value: answer.scaleValue ? `${answer.scaleValue} de 5` : "—" };
  }
  if (question.type === "yes_no") {
    return { prompt: question.prompt, value: answer.text === "sí" ? "Sí" : answer.text === "no" ? "No" : "—" };
  }
  return { prompt: question.prompt, value: answer.text || "—" };
}

export async function getCandidate(id) {
  await connectDB();
  const candidate = await Candidate.findById(id);
  if (!candidate) throw new ApiError(404, "NOT_FOUND", "No se encontró el candidato.");
  const applications = await Application.find({ candidateId: candidate._id }).sort({ submittedAt: -1 });
  const context = await loadContext(applications);
  return {
    id: String(candidate._id),
    name: candidate.name,
    email: candidate.email,
    createdAt: candidate.createdAt,
    applications: applications.map((application) => {
      const version = context.versions.get(String(application.formVersionId));
      const answersById = new Map(application.answers.map((answer) => [answer.questionId, answer]));
      return {
        ...serializeRow(application, candidate, context.forms.get(String(application.formId)), version),
        internalNotes: application.internalNotes || "",
        competencies: (application.scoring?.competencies || []).map((item) => ({
          name: item.name,
          scorePercent: item.scorePercent,
          scoreLabel: formatScore(item.scorePercent),
          questionCount: item.questionCount,
        })),
        answers: (version?.questions || []).map((question) => answerView(question, answersById.get(question.id))),
      };
    }),
  };
}

export async function updateApplication(id, input) {
  await connectDB();
  const application = await Application.findById(id);
  if (!application) throw new ApiError(404, "NOT_FOUND", "No se encontró la postulación.");
  if (input?.reviewStatus != null) {
    if (!["pending", "interview", "hired", "rejected"].includes(input.reviewStatus)) {
      throw new ApiError(422, "VALIDATION", "El estado no es válido.", { reviewStatus: "Elige un estado de revisión." });
    }
    application.reviewStatus = input.reviewStatus;
  }
  if (input?.internalNotes != null) {
    const notes = String(input.internalNotes).trim();
    if (notes.length > LIMITS.notes) {
      throw new ApiError(422, "VALIDATION", "La nota es demasiado larga.", { internalNotes: "Usa hasta 5000 caracteres." });
    }
    application.internalNotes = notes;
  }
  await application.save();
  return { id: String(application._id), reviewStatus: application.reviewStatus, internalNotes: application.internalNotes };
}

export async function exportApplications(url) {
  await connectDB();
  const filter = await buildFilter(url);
  const total = await Application.countDocuments(filter);
  if (total > 5000) {
    throw new ApiError(413, "EXPORT_TOO_LARGE", "Hay demasiadas postulaciones. Acota los filtros antes de exportar.");
  }
  const applications = await Application.find(filter).sort({ submittedAt: -1 });
  const context = await loadContext(applications);
  const competencyNames = [];
  for (const application of applications) {
    for (const competency of application.scoring?.competencies || []) {
      if (!competencyNames.includes(competency.name)) competencyNames.push(competency.name);
    }
  }
  const header = ["Nombre", "Correo", "Evaluación", "Versión", "Puntuación", "Estado", "Fecha", "Notas", "Respuestas", ...competencyNames];
  const rows = applications.map((application) => {
    const version = context.versions.get(String(application.formVersionId));
    const candidate = context.candidates.get(String(application.candidateId));
    const form = context.forms.get(String(application.formId));
    const answersById = new Map(application.answers.map((answer) => [answer.questionId, answer]));
    const responses = (version?.questions || [])
      .map((question) => `${question.prompt}: ${answerView(question, answersById.get(question.id)).value}`)
      .join(" | ");
    const scores = new Map((application.scoring?.competencies || []).map((item) => [item.name, formatScore(item.scorePercent)]));
    return [
      candidate?.name || "",
      candidate?.email || "",
      form?.title || version?.title || "",
      version?.versionNumber || "",
      formatScore(application.scoring?.globalScore),
      REVIEW_LABELS[application.reviewStatus] || application.reviewStatus,
      application.submittedAt ? new Date(application.submittedAt).toISOString() : "",
      application.internalNotes || "",
      responses,
      ...competencyNames.map((name) => scores.get(name) || ""),
    ];
  });
  return toCsv([header, ...rows]);
}
