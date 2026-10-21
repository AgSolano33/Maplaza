import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { isObjectId } from "@/domain/ids";
import { parseDay } from "@/domain/dates";
import { toCsv } from "@/domain/csv";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";
import AnonymousResponse from "@/models/AnonymousResponse";

async function resolveVersion(formId, versionId) {
  await connectDB();
  if (!isObjectId(formId)) throw new ApiError(422, "VALIDATION", "Elige un formulario.", { formId: "Formulario no válido." });
  const form = await Form.findById(formId);
  if (!form || form.modality !== "climate") {
    throw new ApiError(404, "NOT_FOUND", "No se encontró la encuesta de clima.");
  }
  const versions = await FormVersion.find({ formId: form._id }).sort({ versionNumber: -1 });
  if (!versions.length) {
    throw new ApiError(409, "UNPUBLISHED", "Esta encuesta todavía no tiene una versión publicada.");
  }
  const version = versionId ? versions.find((item) => String(item._id) === versionId) : versions.length === 1 ? versions[0] : null;
  return { form, versions, version };
}

function publicQuestions(version) {
  return version.questions.map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    scaleLabels: question.scaleLabels || [],
    options: (question.options || []).map((option) => ({ id: option.id, label: option.label })),
  }));
}

async function loadRows(versionId) {
  const docs = await AnonymousResponse.find({ formVersionId: versionId })
    .select("areaId areaName submittedAt answers")
    .sort({ submittedAt: -1 })
    .lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    areaId: doc.areaId ? String(doc.areaId) : "",
    areaName: doc.areaName || "Sin área",
    submittedAt: doc.submittedAt,
    answers: doc.answers || [],
  }));
}

function answerText(question, answer) {
  if (!answer) return "Sin respuesta";
  if (question.type === "single" || question.type === "dropdown") {
    const option = (question.options || []).find((item) => item.id === answer.optionId);
    return option?.label || "Opción no disponible";
  }
  if (question.type === "multiple") {
    const labels = (question.options || [])
      .filter((item) => (answer.optionIds || []).includes(item.id))
      .map((item) => item.label);
    return labels.length ? labels.join(", ") : "Sin respuesta";
  }
  if (question.type === "scale" || question.type === "rating") {
    return answer.scaleValue ? `${answer.scaleValue} de 5` : "Sin respuesta";
  }
  if (question.type === "yes_no") {
    if (answer.text === "sí") return "Sí";
    if (answer.text === "no") return "No";
    return "Sin respuesta";
  }
  return answer.text || "Sin respuesta";
}

function presentResponse(row, questions) {
  const byId = new Map((row.answers || []).map((answer) => [answer.questionId, answer]));
  return {
    id: row.id,
    submittedAt: row.submittedAt,
    areaName: row.areaName,
    anonymous: true,
    answers: questions.map((question) => ({
      prompt: question.prompt,
      value: answerText(question, byId.get(question.id)),
    })),
  };
}

export async function climateReport(url) {
  const formId = url.searchParams.get("formId") || "";
  const versionId = url.searchParams.get("versionId") || "";
  const areaId = url.searchParams.get("areaId") || "";
  const from = parseDay(url.searchParams.get("from") || "");
  const to = parseDay(url.searchParams.get("to") || "", true);
  const { form, versions, version } = await resolveVersion(formId, versionId);
  const payload = {
    form: { id: String(form._id), title: form.title },
    versions: versions.map((item) => ({ id: String(item._id), versionNumber: item.versionNumber, title: item.title })),
  };
  if (!version) {
    return { ...payload, report: null, message: "Elige una versión para ver resultados. Las versiones no se mezclan." };
  }
  const questions = publicQuestions(version);
  const responses = (await loadRows(version._id))
    .filter((row) => {
      const time = new Date(row.submittedAt).getTime();
      if (from && time < from.getTime()) return false;
      if (to && time > to.getTime()) return false;
      if (areaId && row.areaId !== areaId) return false;
      return true;
    })
    .map((row) => presentResponse(row, questions));
  return {
    ...payload,
    versionId: String(version._id),
    questions: questions.map((question) => question.prompt),
    responses,
  };
}

export async function exportClimate(url) {
  const result = await climateReport(url);
  if (!result.responses) {
    throw new ApiError(422, "VALIDATION", result.message || "Elige una versión para exportar.");
  }
  const header = ["Fecha", "Área", "Identificación", ...(result.questions || [])];
  const rows = [header];
  for (const response of result.responses) {
    rows.push([
      response.submittedAt ? new Date(response.submittedAt).toISOString() : "",
      response.areaName,
      "Anónima",
      ...response.answers.map((answer) => answer.value),
    ]);
  }
  return toCsv(rows);
}
