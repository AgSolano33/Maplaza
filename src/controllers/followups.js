import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { LIMITS } from "@/domain/constants";
import { parseDay } from "@/domain/dates";
import { summarizeFollowUps } from "@/domain/tenure";
import { formatScore } from "@/domain/scoring";
import Application from "@/models/Application";
import Candidate from "@/models/Candidate";
import Form from "@/models/Form";
import EmploymentFollowUp from "@/models/EmploymentFollowUp";

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function validateFollowUp(input) {
  const errors = {};
  const startDate = parseDay(input?.startDate || "");
  const situation = input?.situation === "exited" ? "exited" : input?.situation === "active" ? "active" : "";
  if (!startDate) errors.startDate = "Indica la fecha de ingreso.";
  if (!situation) errors.situation = "Indica si la persona sigue activa o salió.";
  let exitDate = null;
  let exitReason = "";
  if (situation === "exited") {
    exitDate = parseDay(input?.exitDate || "");
    exitReason = clean(input?.exitReason, LIMITS.reason);
    if (!exitDate) errors.exitDate = "Indica la fecha de salida.";
    if (startDate && exitDate && exitDate < startDate) errors.exitDate = "La salida no puede ser anterior al ingreso.";
    if (!exitReason) errors.exitReason = "Indica el motivo de salida.";
  }
  const notes = clean(input?.notes, LIMITS.notes);
  if (String(input?.notes || "").trim().length > LIMITS.notes) errors.notes = "Las observaciones son demasiado largas.";
  return { ok: Object.keys(errors).length === 0, errors, value: { startDate, situation, exitDate, exitReason, notes } };
}

async function present(records) {
  const applications = await Application.find({ _id: { $in: records.map((item) => item.applicationId) } });
  const candidates = await Candidate.find({ _id: { $in: records.map((item) => item.candidateId) } });
  const forms = await Form.find({ _id: { $in: applications.map((item) => item.formId) } }).select("title");
  const applicationById = new Map(applications.map((item) => [String(item._id), item]));
  const candidateById = new Map(candidates.map((item) => [String(item._id), item]));
  const formById = new Map(forms.map((item) => [String(item._id), item]));
  return records.map((record) => {
    const application = applicationById.get(String(record.applicationId));
    const candidate = candidateById.get(String(record.candidateId));
    return {
      id: String(record._id),
      applicationId: String(record.applicationId),
      candidateId: String(record.candidateId),
      name: candidate?.name || "Candidato",
      email: candidate?.email || "",
      formTitle: formById.get(String(application?.formId))?.title || "Evaluación",
      globalScore: application?.scoring?.globalScore ?? null,
      globalScoreLabel: formatScore(application?.scoring?.globalScore),
      startDate: record.startDate,
      situation: record.situation,
      exitDate: record.exitDate,
      exitReason: record.exitReason || "",
      notes: record.notes || "",
    };
  });
}

export async function listFollowUps() {
  await connectDB();
  const [records, hired] = await Promise.all([
    EmploymentFollowUp.find().sort({ startDate: -1 }),
    Application.find({ reviewStatus: "hired" }).sort({ submittedAt: -1 }),
  ]);
  const rows = await present(records);
  const summary = summarizeFollowUps(rows);
  const followed = new Set(records.map((item) => String(item.applicationId)));
  const candidates = await Candidate.find({ _id: { $in: hired.map((item) => item.candidateId) } });
  const candidateById = new Map(candidates.map((item) => [String(item._id), item]));
  const forms = await Form.find({ _id: { $in: hired.map((item) => item.formId) } }).select("title");
  const formById = new Map(forms.map((item) => [String(item._id), item]));
  return {
    summary,
    items: summary.rows.map((row) => ({
      ...(rows.find((item) => item.id === row.id) || {}),
      tenureDays: row.tenureDays,
    })),
    pendingHires: hired
      .filter((application) => !followed.has(String(application._id)))
      .map((application) => ({
        applicationId: String(application._id),
        candidateId: String(application.candidateId),
        name: candidateById.get(String(application.candidateId))?.name || "Candidato",
        formTitle: formById.get(String(application.formId))?.title || "Evaluación",
        globalScoreLabel: formatScore(application.scoring?.globalScore),
      })),
  };
}

export async function createFollowUp(input) {
  await connectDB();
  const application = await Application.findById(input?.applicationId);
  if (!application) throw new ApiError(404, "NOT_FOUND", "No se encontró la postulación.");
  if (application.reviewStatus !== "hired") {
    throw new ApiError(409, "NOT_HIRED", "El seguimiento se registra cuando la postulación está en Contratado.");
  }
  const parsed = validateFollowUp(input);
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "Revisa el seguimiento.", parsed.errors);
  const existing = await EmploymentFollowUp.findOne({ applicationId: application._id });
  if (existing) throw new ApiError(409, "DUPLICATE", "Esa contratación ya tiene seguimiento.");
  const record = await EmploymentFollowUp.create({
    candidateId: application.candidateId,
    applicationId: application._id,
    ...parsed.value,
  });
  const [row] = await present([record]);
  return row;
}

export async function updateFollowUp(id, input) {
  await connectDB();
  const record = await EmploymentFollowUp.findById(id);
  if (!record) throw new ApiError(404, "NOT_FOUND", "No se encontró el seguimiento.");
  const parsed = validateFollowUp(input);
  if (!parsed.ok) throw new ApiError(422, "VALIDATION", "Revisa el seguimiento.", parsed.errors);
  Object.assign(record, parsed.value);
  await record.save();
  const [row] = await present([record]);
  return row;
}
