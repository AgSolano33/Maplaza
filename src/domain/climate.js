import { MIN_CLIMATE_SAMPLE } from "./constants.js";

function inPeriod(response, from, to) {
  const time = new Date(response.submittedAt).getTime();
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}

function summarize(responses, questions) {
  return {
    count: responses.length,
    questions: questions.map((question) => summarizeQuestion(question, responses)),
  };
}

function summarizeQuestion(question, responses) {
  if (question.type === "scale" || question.type === "rating") {
    const values = responses
      .map((response) => response.answers.find((answer) => answer.questionId === question.id)?.scaleValue)
      .filter((value) => Number.isInteger(value));
    const average = values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : null;
    return {
      questionId: question.id,
      prompt: question.prompt,
      type: question.type,
      average,
      distribution: [1, 2, 3, 4, 5].map((value) => ({
        value,
        label: question.type === "rating" ? `${value} estrella${value === 1 ? "" : "s"}` : question.scaleLabels?.[value - 1] || String(value),
        count: values.filter((item) => item === value).length,
      })),
    };
  }

  if (question.type === "single" || question.type === "dropdown" || question.type === "multiple") {
    return {
      questionId: question.id,
      prompt: question.prompt,
      type: question.type,
      distribution: (question.options || []).map((option) => ({
        optionId: option.id,
        label: option.label,
        count: responses.filter((response) =>
          response.answers.some((answer) => {
            if (answer.questionId !== question.id) return false;
            if (question.type === "multiple") return (answer.optionIds || []).includes(option.id);
            return answer.optionId === option.id;
          }),
        ).length,
      })),
    };
  }

  if (question.type === "yes_no") {
    const values = responses
      .map((response) => response.answers.find((answer) => answer.questionId === question.id)?.text)
      .filter((value) => value === "sí" || value === "no");
    return {
      questionId: question.id,
      prompt: question.prompt,
      type: "yes_no",
      distribution: ["sí", "no"].map((value) => ({
        value,
        label: value === "sí" ? "Sí" : "No",
        count: values.filter((item) => item === value).length,
      })),
    };
  }

  return {
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    individualReview: false,
    message: "Esta respuesta se guarda sin identificadores y no se lista de forma individual.",
  };
}

function areaLabel(group) {
  const latest = [...group].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  )[0];
  return latest?.areaName || "Sin área";
}

/**
 * Un corte solo se publica si tiene al menos 5 respuestas y el complemento
 * excluido por los filtros es 0 o también al menos 5. Así no se puede
 * reconstruir un grupo pequeño restando totales.
 */
export function buildClimateReport({ responses, questions, areaId = "", from = null, to = null }) {
  const universe = responses || [];
  const periodMatched = universe.filter((response) => inPeriod(response, from, to));
  const matched = areaId ? periodMatched.filter((response) => response.areaId === areaId) : periodMatched;
  const excluded = universe.length - matched.length;
  const safe = matched.length >= MIN_CLIMATE_SAMPLE && (excluded === 0 || excluded >= MIN_CLIMATE_SAMPLE);
  const hidden = {
    available: false,
    minimum: MIN_CLIMATE_SAMPLE,
    reason: matched.length < MIN_CLIMATE_SAMPLE ? "sample" : "complement",
    message:
      matched.length < MIN_CLIMATE_SAMPLE
        ? "Se necesitan al menos 5 respuestas en este corte para mostrar resultados agregados."
        : "Este corte permanece oculto para evitar que se identifiquen grupos de menos de 5 respuestas.",
  };

  if (!safe) return hidden;

  const periodGroups = new Map();
  for (const response of periodMatched) {
    const key = response.areaId || "";
    if (!periodGroups.has(key)) periodGroups.set(key, []);
    periodGroups.get(key).push(response);
  }
  const hasSmallArea = [...periodGroups.values()].some(
    (group) => group.length > 0 && group.length < MIN_CLIMATE_SAMPLE,
  );
  if (areaId && hasSmallArea) return { ...hidden, reason: "complement" };

  const groups = new Map();
  for (const response of matched) {
    const key = response.areaId || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(response);
  }

  const areaEntries = [...groups.entries()].map(([key, group]) => ({
    areaId: key,
    areaName: areaLabel(group),
    count: group.length,
    group,
  }));
  const visible = areaEntries.filter((entry) => entry.count >= MIN_CLIMATE_SAMPLE);
  const remainder = matched.length - visible.reduce((total, entry) => total + entry.count, 0);
  const showBreakdown =
    !areaId && !hasSmallArea && visible.length > 0 && (remainder === 0 || remainder >= MIN_CLIMATE_SAMPLE);

  return {
    available: true,
    minimum: MIN_CLIMATE_SAMPLE,
    overall: summarize(matched, questions),
    areas: showBreakdown
      ? visible.map((entry) => ({
          areaId: entry.areaId,
          areaName: entry.areaName,
          ...summarize(entry.group, questions),
        }))
      : [],
    breakdownHidden: !areaId && hasSmallArea,
    notice:
      "Los resultados son agregados. El acceso público y anónimo no garantiza una sola respuesta por empleado, y las respuestas abiertas no se muestran de forma individual.",
  };
}
