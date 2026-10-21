import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { isObjectId } from "@/domain/ids";
import { describeAnswer } from "@/domain/answers";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";
import AnonymousResponse from "@/models/AnonymousResponse";
import Application from "@/models/Application";
import Candidate from "@/models/Candidate";

const LIMIT = 200;

function present(questions, answers) {
  const byId = new Map((answers || []).map((answer) => [answer.questionId, answer]));
  return (questions || []).map((question) => describeAnswer(question, byId.get(question.id)));
}

export async function listFormResponses(id) {
  await connectDB();
  if (!isObjectId(id)) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  const form = await Form.findById(id).select("modality");
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  const versions = await FormVersion.find({ formId: form._id }).select("versionNumber questions");
  const versionById = new Map(versions.map((version) => [String(version._id), version]));

  if (form.modality === "climate") {
    const [docs, total] = await Promise.all([
      AnonymousResponse.find({ formId: form._id }).sort({ submittedAt: -1 }).limit(LIMIT),
      AnonymousResponse.countDocuments({ formId: form._id }),
    ]);
    return {
      total,
      items: docs.map((doc) => {
        const version = versionById.get(String(doc.formVersionId));
        return {
          id: String(doc._id),
          submittedAt: doc.submittedAt,
          name: "",
          email: "",
          anonymous: true,
          areaName: doc.areaName || "Sin área",
          versionNumber: version?.versionNumber || null,
          answers: present(version?.questions, doc.answers),
        };
      }),
    };
  }

  const [docs, total] = await Promise.all([
    Application.find({ formId: form._id }).sort({ submittedAt: -1 }).limit(LIMIT),
    Application.countDocuments({ formId: form._id }),
  ]);
  const candidates = await Candidate.find({ _id: { $in: docs.map((doc) => doc.candidateId) } }).select("name email");
  const byCandidate = new Map(candidates.map((candidate) => [String(candidate._id), candidate]));
  return {
    total,
    items: docs.map((doc) => {
      const version = versionById.get(String(doc.formVersionId));
      const person = byCandidate.get(String(doc.candidateId));
      return {
        id: String(doc._id),
        submittedAt: doc.submittedAt,
        name: person?.name || "",
        email: person?.email || "",
        anonymous: false,
        areaName: "",
        versionNumber: version?.versionNumber || null,
        answers: present(version?.questions, doc.answers),
      };
    }),
  };
}
