import { DEFAULT_SCALE_LABELS } from "./constants.js";
import { normalizeTextStyle } from "./theme.js";
import { storedImage } from "./images.js";

const PUBLIC_QUESTION_KEYS = ["id", "type", "prompt", "required", "shuffleOptions", "options", "scaleLabels"];

export function toPublicForm(source) {
  const modality = source?.modality === "climate" ? "climate" : "recruitment";
  return {
    title: source?.title || "",
    description: source?.description || "",
    modality,
    instructions: source?.instructions || "",
    confirmationMessage: source?.confirmationMessage || "",
    requiresIdentity: modality === "recruitment",
    appearance: {
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(source?.appearance?.primaryColor || "") ? source.appearance.primaryColor : "#315ce8",
      backgroundColor: /^#[0-9a-fA-F]{6}$/.test(source?.appearance?.backgroundColor || "") ? source.appearance.backgroundColor : "#f5f7fb",
      ...normalizeTextStyle(source?.appearance),
      logo: imageSource(source?.appearance?.logo),
      cover: imageSource(source?.appearance?.cover),
      poster: imageSource(source?.appearance?.poster),
    },
    questions: (source?.questions || []).map((question) => {
      const type = question.type;
      const publicQuestion = {
        id: question.id,
        type,
        prompt: question.prompt || "",
        required: Boolean(question.required),
        shuffleOptions: Boolean(question.shuffleOptions),
        options:
          type === "single" || type === "dropdown" || type === "multiple"
            ? (question.options || []).map((option) => ({
                id: option.id,
                label: option.label,
              }))
            : [],
        scaleLabels: type === "scale" ? normalizeScaleLabels(question.scaleLabels) : [],
      };
      return Object.fromEntries(
        PUBLIC_QUESTION_KEYS.map((key) => [key, publicQuestion[key]]),
      );
    }),
  };
}

function imageSource(value) {
  return storedImage(value, 900_000);
}

function normalizeScaleLabels(labels) {
  const source = Array.isArray(labels) ? labels : [];
  return [0, 1, 2, 3, 4].map((index) => source[index] || DEFAULT_SCALE_LABELS[index]);
}

export function exposesInternalScoring(value) {
  if (Array.isArray(value)) return value.some(exposesInternalScoring);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => {
    const normalized = key.toLowerCase();
    if (
      normalized.includes("score") ||
      normalized.includes("competenc") ||
      key === "passwordHash" ||
      key === "internalNotes" ||
      key === "reviewStatus"
    ) {
      return true;
    }
    return exposesInternalScoring(nested);
  });
}
