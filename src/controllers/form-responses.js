import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { isObjectId } from "@/domain/ids";
import { describeAnswer } from "@/domain/answers";
import { formatScore } from "@/domain/scoring";
import Form from "@/models/Form";
import FormVersion from "@/models/FormVersion";
import AnonymousResponse from "@/models/AnonymousResponse";
import Application from "@/models/Application";
import Candidate from "@/models/Candidate";
import Competency from "@/models/Competency";

const LIMIT = 200;

function present(questions, answers) {
  const byId = new Map((answers || []).map((answer) => [answer.questionId, answer]));
  const items = (questions || []).map((question) => presentQuestion(question, byId.get(question.id)));
  const scored = items.filter((item) => item.maximum != null);
  const earned = scored.reduce((sum, item) => sum + item.points, 0);
  const possible = scored.reduce((sum, item) => sum + item.maximum, 0);
  const competencies = [];
  for (const item of scored) {
    const name = item.competencyName || "Competencia";
    let bucket = competencies.find((entry) => entry.name === name);
    if (!bucket) {
      bucket = { name, earned: 0, possible: 0 };
      competencies.push(bucket);
    }
    bucket.earned += item.points;
    bucket.possible += item.maximum;
  }
  return {
    scored: possible > 0,
    earned,
    possible,
    percent: possible > 0 ? (earned / possible) * 100 : null,
    competencies: competencies.map((item) => ({
      name: item.name,
      earned: item.earned,
      possible: item.possible,
      scorePercent: (item.earned / item.possible) * 100,
      scoreLabel: formatScore((item.earned / item.possible) * 100),
    })),
    answers: items,
  };
}

function presentQuestion(question, answer) {
  const described = describeAnswer(question, answer);
  const choice = question.type === "single" || question.type === "dropdown" || question.type === "multiple";
  const options = choice
    ? (question.options || []).map((option) => ({
        id: option.id,
        label: option.label || "Opción",
        selected: question.type === "multiple" ? (answer?.optionIds || []).includes(option.id) : answer?.optionId === option.id,
      }))
    : question.type === "yes_no"
      ? [
          { id: "sí", label: "Sí", selected: answer?.text === "sí" },
          { id: "no", label: "No", selected: answer?.text === "no" },
        ]
      : [];
  const optionScores = (question.options || []).map((option) => (typeof option.score === "number" ? option.score : 0));
  const hasPoints = question.type === "single" && (question.scored || question.competencyId || question.competencyName || optionScores.some((score) => score > 0));
  const maximum = hasPoints ? Math.max(0, ...optionScores) : 0;
  const selected = (question.options || []).find((option) => option.id === answer?.optionId);
  const points = hasPoints && maximum > 0 ? (typeof selected?.score === "number" ? selected.score : 0) : null;
  return {
    prompt: question.prompt || "Pregunta",
    type: question.type,
    competencyName: hasPoints ? question.competencyName || "" : "",
    value: described.value,
    options,
    points,
    maximum: hasPoints && maximum > 0 ? maximum : null,
  };
}

function storedReview(scoring) {
  if (typeof scoring?.globalScore !== "number") return null;
  const competencies = (scoring.competencies || []).map((item) => ({
    name: item.name,
    earned: item.averageRaw,
    possible: null,
    scorePercent: item.scorePercent,
    scoreLabel: formatScore(item.scorePercent),
  }));
  const earned = competencies.reduce((sum, item) => sum + (typeof item.earned === "number" ? item.earned : 0), 0);
  return {
    scored: true,
    earned,
    possible: null,
    percent: scoring.globalScore,
    competencies,
  };
}

function plainQuestion(question) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt || "",
    scored: Boolean(question.scored),
    competencyId: question.competencyId ? String(question.competencyId) : "",
    competencyName: question.competencyName || "",
    options: (question.options || []).map((option) => ({
      id: option.id,
      label: option.label || "",
      score: typeof option.score === "number" ? option.score : undefined,
    })),
  };
}

function withLiveScores(versionQuestions, liveQuestions) {
  const liveById = new Map((liveQuestions || []).map((question) => [question.id, plainQuestion(question)]));
  return (versionQuestions || []).map((question) => {
    const current = plainQuestion(question);
    const live = liveById.get(current.id);
    const versionHasPoints = current.options.some((option) => typeof option.score === "number" && option.score > 0);
    if (!live || versionHasPoints) return current;
    const liveOptions = new Map(live.options.map((option) => [option.id, option]));
    return {
      ...current,
      scored: current.scored || live.scored,
      competencyId: current.competencyId || live.competencyId,
      competencyName: current.competencyName || live.competencyName,
      options: current.options.map((option) => ({
        ...option,
        score: typeof option.score === "number" ? option.score : liveOptions.get(option.id)?.score,
      })),
    };
  });
}

async function nameCompetencies(questions) {
  const ids = [...new Set(questions.map((question) => question.competencyId).filter(Boolean))];
  if (!ids.length) return questions;
  const docs = await Competency.find({ _id: { $in: ids } }).select("name");
  const byId = new Map(docs.map((item) => [String(item._id), item.name]));
  return questions.map((question) => ({
    ...question,
    competencyName: question.competencyName || byId.get(question.competencyId) || "",
  }));
}

export async function listFormResponses(id) {
  await connectDB();
  if (!isObjectId(id)) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  const form = await Form.findById(id).select("modality questions");
  if (!form) throw new ApiError(404, "NOT_FOUND", "No se encontró el formulario.");
  const versions = await FormVersion.find({ formId: form._id }).select("versionNumber questions");
  const versionById = new Map(versions.map((version) => [String(version._id), version]));
  const reviewed = new Map();
  async function reviewQuestions(version) {
    const key = version ? String(version._id) : "live";
    if (!reviewed.has(key)) reviewed.set(key, nameCompetencies(withLiveScores(version?.questions, form.questions)));
    return reviewed.get(key);
  }

  if (form.modality === "climate") {
    const [docs, total] = await Promise.all([
      AnonymousResponse.find({ formId: form._id }).sort({ submittedAt: -1 }).limit(LIMIT),
      AnonymousResponse.countDocuments({ formId: form._id }),
    ]);
    return {
      total,
      items: await Promise.all(docs.map(async (doc) => {
        const version = versionById.get(String(doc.formVersionId));
        return {
          id: String(doc._id),
          submittedAt: doc.submittedAt,
          name: "",
          email: "",
          anonymous: true,
          areaName: doc.areaName || "",
          versionNumber: version?.versionNumber || null,
          ...present(await reviewQuestions(version), doc.answers),
        };
      })),
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
    items: await Promise.all(docs.map(async (doc) => {
      const version = versionById.get(String(doc.formVersionId));
      const person = byCandidate.get(String(doc.candidateId));
      const review = present(await reviewQuestions(version), doc.answers);
      return {
        id: String(doc._id),
        submittedAt: doc.submittedAt,
        name: person?.name || "",
        email: person?.email || "",
        anonymous: false,
        areaName: "",
        versionNumber: version?.versionNumber || null,
        globalScore: doc.scoring?.globalScore ?? null,
        globalScoreLabel: formatScore(doc.scoring?.globalScore),
        ...(review.scored ? review : { ...review, ...(storedReview(doc.scoring) || {}) }),
      };
    })),
  };
}
