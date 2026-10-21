import { DEFAULT_SCALE_LABELS } from "./constants.js";

const TYPE_FROM_SURVEY = {
  radiogroup: "single",
  rating: "scale",
  text: "short_text",
  comment: "long_text",
};

function readText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object") {
    return readText(value.es || value.default || value.en || "");
  }
  return "";
}

function isStableId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

function readScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function elementsInOrder(json) {
  const pages = Array.isArray(json?.pages) && json.pages.length
    ? json.pages
    : [{ elements: json?.elements || [] }];
  const elements = [];
  for (const page of pages) {
    for (const element of page?.elements || []) {
      if (element?.type === "panel" && Array.isArray(element.elements)) elements.push(...element.elements);
      else if (element) elements.push(element);
    }
  }
  return elements;
}

function optionId(choice, questionIndex, optionIndex) {
  const value = choice && typeof choice === "object" ? choice.value : choice;
  const asString = value == null ? "" : String(value);
  return isStableId(asString) ? asString : `opcion-${questionIndex}-${optionIndex}`;
}

function optionLabel(choice) {
  if (typeof choice === "string" || typeof choice === "number") return readText(choice);
  if (choice && typeof choice === "object") return readText(choice.text);
  return "";
}

function scaleLabelsFrom(element) {
  const values = Array.isArray(element?.rateValues) ? element.rateValues : [];
  return [0, 1, 2, 3, 4].map((index) => {
    const item = values[index];
    if (item == null) return DEFAULT_SCALE_LABELS[index];
    const text = typeof item === "object" ? readText(item.text) : readText(item);
    return text || DEFAULT_SCALE_LABELS[index];
  });
}

export function questionsToSurvey(questions) {
  return {
    pages: [{
      name: "preguntas",
      elements: (questions || []).map((question) => {
        const base = {
          name: question.id,
          title: question.prompt || "",
          isRequired: Boolean(question.required),
        };
        if (question.type === "single") {
          return {
            ...base,
            type: "radiogroup",
            ...(question.competencyId ? { competencyId: question.competencyId } : {}),
            choices: (question.options || []).map((option) => ({
              value: option.id,
              text: option.label || "",
              score: typeof option.score === "number" ? option.score : 0,
            })),
          };
        }
        if (question.type === "scale") {
          const labels = question.scaleLabels?.length === 5 ? question.scaleLabels : DEFAULT_SCALE_LABELS;
          return {
            ...base,
            type: "rating",
            rateMin: 1,
            rateMax: 5,
            rateValues: labels.map((text, index) => ({ value: index + 1, text })),
          };
        }
        return { ...base, type: question.type === "long_text" ? "comment" : "text" };
      }),
    }],
  };
}

export function questionsFromSurvey(json, modality = "recruitment") {
  const recruitment = modality === "recruitment";
  return elementsInOrder(json).flatMap((element, index) => {
    const type = TYPE_FROM_SURVEY[element?.type];
    if (!type) return [];
    const scorable = recruitment && type === "single";
    const question = {
      id: isStableId(element.name) ? element.name : `pregunta-${index}`,
      type,
      prompt: readText(element.title),
      required: scorable ? true : Boolean(element.isRequired),
      competencyId: scorable && element.competencyId ? String(element.competencyId) : "",
      options: [],
      scaleLabels: [...DEFAULT_SCALE_LABELS],
    };
    if (type === "single") {
      const choices = Array.isArray(element.choices) ? element.choices : [];
      question.options = choices.map((choice, optionIndex) => ({
        id: optionId(choice, index, optionIndex),
        label: optionLabel(choice),
        score: scorable ? readScore(choice && typeof choice === "object" ? choice.score : 0) : 0,
      }));
    }
    if (type === "scale") question.scaleLabels = scaleLabelsFrom(element);
    return [question];
  });
}
