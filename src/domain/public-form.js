import { DEFAULT_SCALE_LABELS } from "./constants.js";

const PUBLIC_QUESTION_KEYS = ["id", "type", "prompt", "required", "options", "scaleLabels"];

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
      logo: imageSource(source?.appearance?.logo),
      cover: imageSource(source?.appearance?.cover),
    },
    questions: (source?.questions || []).map((question) => {
      const type = question.type;
      const publicQuestion = {
        id: question.id,
        type,
        prompt: question.prompt || "",
        required: Boolean(question.required),
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
  const text = String(value || "");
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(text)) return "";
  return text;
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
