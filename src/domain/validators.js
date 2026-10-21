import { DEFAULT_SCALE_LABELS, LIMITS, QUESTION_TYPES } from "./constants.js";
import { fieldError, storedFieldText } from "./fields.js";
import { isObjectId, isStableId, newId } from "./ids.js";

function text(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function multiline(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeCatalogName(value) {
  return text(value, LIMITS.catalog);
}

export function normalizeDraft(input, { strict = false } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const errors = {};
  const modality = source.modality === "climate" ? "climate" : source.modality === "recruitment" ? "recruitment" : "";
  if (!modality) errors.modality = "Elige reclutamiento o clima laboral.";

  const title = text(source.title, LIMITS.title + 20);
  if (!title) errors.title = "Escribe un título.";
  else if (title.length > LIMITS.title) errors.title = `El título admite hasta ${LIMITS.title} caracteres.`;

  const description = multiline(source.description, LIMITS.description);
  const instructions = multiline(source.instructions, LIMITS.instructions);
  const confirmationMessage = multiline(source.confirmationMessage, LIMITS.confirmation);
  const targetRole = modality === "recruitment" ? text(source.targetRole, LIMITS.role) : "";
  if (strict && modality === "recruitment" && !targetRole) {
    errors.targetRole = "Indica el puesto objetivo.";
  }

  const opensAt = parseDate(source.opensAt);
  const closesAt = parseDate(source.closesAt);
  if (source.opensAt && !opensAt) errors.opensAt = "La fecha de apertura no es válida.";
  if (source.closesAt && !closesAt) errors.closesAt = "La fecha de cierre no es válida.";
  if (opensAt && closesAt && opensAt >= closesAt) {
    errors.closesAt = "El cierre debe ser posterior a la apertura.";
  }

  const appearance = normalizeAppearance(source.appearance, errors);

  const questions = [];
  const seenQuestions = new Set();
  const rawQuestions = Array.isArray(source.questions) ? source.questions : [];
  if (strict && rawQuestions.length === 0) errors.questions = "Agrega al menos una pregunta.";

  rawQuestions.forEach((raw, index) => {
    const parsed = normalizeQuestion(raw, { strict, modality, index, errors, seenQuestions });
    if (parsed) questions.push(parsed);
  });

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      description,
      modality: modality || "recruitment",
      targetRole,
      instructions,
      confirmationMessage:
        confirmationMessage ||
        (modality === "climate"
          ? "Gracias por responder. Tu participación es anónima y no se asocia a tu identidad."
          : "Recibimos tu evaluación. El equipo de RH la revisará. Esta respuesta no determina por sí sola una contratación."),
      opensAt,
      closesAt,
      questions,
      appearance,
    },
  };
}

function normalizeAppearance(raw, errors) {
  const source = raw && typeof raw === "object" ? raw : {};
  let primaryColor = "#315ce8";
  if (!source.primaryColor || /^#[0-9a-fA-F]{6}$/.test(source.primaryColor)) {
    primaryColor = source.primaryColor || "#315ce8";
  } else {
    errors.primaryColor = "Usa un color como #315ce8.";
  }
  return {
    primaryColor,
    logo: imageData(source.logo, 450_000, "logo", errors),
    cover: imageData(source.cover, 900_000, "cover", errors),
  };
}

function imageData(value, max, field, errors) {
  const text = String(value || "");
  if (!text) return "";
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(text) || text.length > max) {
    errors[field] = "Usa una imagen PNG o JPG más pequeña.";
    return "";
  }
  return text;
}

function parseDate(value) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeQuestion(raw, { strict, modality, index, errors, seenQuestions }) {
  if (!raw || typeof raw !== "object") {
    errors[`questions.${index}`] = "La pregunta no es válida.";
    return null;
  }
  const type = QUESTION_TYPES.includes(raw.type) ? raw.type : "";
  if (!type) {
    errors[`questions.${index}.type`] = "Elige un tipo de pregunta.";
    return null;
  }
  const prompt = multiline(raw.prompt, LIMITS.prompt);
  if (strict && !prompt) errors[`questions.${index}.prompt`] = "Escribe el enunciado.";

  let id = isStableId(raw.id) ? raw.id : newId();
  if (seenQuestions.has(id)) id = newId();
  seenQuestions.add(id);

  const scorable = modality === "recruitment" && type === "single" && (raw.scored === true || isObjectId(raw.competencyId));
  const required = scorable ? true : Boolean(raw.required);
  const question = {
    id,
    type,
    prompt,
    required,
    competencyId: null,
    competencyName: "",
    scored: scorable,
    options: [],
    scaleLabels: [],
  };

  if (type === "single" || type === "dropdown" || type === "multiple") {
    const seenOptions = new Set();
    const options = Array.isArray(raw.options) ? raw.options : [];
    if (strict && options.length < 2) {
      errors[`questions.${index}.options`] = "Agrega al menos dos opciones.";
    }
    for (const option of options) {
      let optionId = isStableId(option?.id) ? option.id : newId();
      if (seenOptions.has(optionId)) optionId = newId();
      seenOptions.add(optionId);
      const label = text(option?.label, LIMITS.option);
      if (strict && !label) errors[`questions.${index}.options`] = "Completa todas las opciones.";
      const normalized = { id: optionId, label };
      if (scorable) {
        const score = Number(option?.score);
        if (!Number.isInteger(score) || score < 0 || score > 5) {
          errors[`questions.${index}.score`] = "Cada opción puntuable vale entre 0 y 5.";
        }
        normalized.score = Number.isInteger(score) ? Math.min(5, Math.max(0, score)) : 0;
      }
      question.options.push(normalized);
    }
    if (scorable) {
      if (!isObjectId(raw.competencyId)) {
        if (strict) errors[`questions.${index}.competencyId`] = "Asocia la pregunta a una competencia.";
      } else {
        question.competencyId = raw.competencyId;
      }
    }
  }

  if (type === "scale") {
    const labels = Array.isArray(raw.scaleLabels) ? raw.scaleLabels : [];
    question.scaleLabels = [0, 1, 2, 3, 4].map((labelIndex) => {
      const label = text(labels[labelIndex], LIMITS.scaleLabel);
      return label || DEFAULT_SCALE_LABELS[labelIndex];
    });
    if (strict && question.scaleLabels.some((label) => !label)) {
      errors[`questions.${index}.scaleLabels`] = "Completa las etiquetas de la escala.";
    }
  }

  return question;
}

const FORBIDDEN_FIELDS = [
  "score",
  "scores",
  "area",
  "areaId",
  "areaName",
  "reviewStatus",
  "status",
  "userId",
  "ip",
  "userAgent",
  "competency",
  "competencyId",
  "internalNotes",
];

export function validateSubmission(version, body) {
  const errors = {};
  const raw = body && typeof body === "object" ? body : {};
  for (const key of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      errors[key] = "Este dato no forma parte del envío.";
    }
  }

  let name = "";
  let email = "";
  if (version.modality === "climate") {
    if (String(raw.name || "").trim() || String(raw.email || "").trim()) {
      errors.identity = "Esta encuesta es anónima y no acepta nombre ni correo.";
    }
  } else {
    name = text(raw.name, LIMITS.name);
    email = String(raw.email || "").trim().toLowerCase();
    if (!name) errors.name = "Escribe tu nombre.";
    else if (name.length > LIMITS.name) errors.name = "El nombre es demasiado largo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > LIMITS.email) {
      errors.email = "Escribe un correo válido.";
    }
  }

  if (!Array.isArray(raw.answers)) {
    errors.answers = "Faltan las respuestas.";
    return { ok: false, errors, value: { name, email, answers: [] } };
  }

  const questions = version.questions || [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set();
  const answers = [];

  for (const item of raw.answers) {
    if (!item || typeof item !== "object") {
      errors.answers = "Hay una respuesta inválida.";
      continue;
    }
    if (item.score !== undefined || item.points !== undefined || item.areaId !== undefined) {
      errors.answers = "No envíes puntuaciones ni datos administrativos.";
      continue;
    }
    const question = byId.get(item.questionId);
    if (!question) {
      errors.answers = "Hay una pregunta que no pertenece a este formulario.";
      continue;
    }
    if (seen.has(question.id)) {
      errors.answers = "Hay una pregunta repetida.";
      continue;
    }
    seen.add(question.id);
    const parsed = parseSubmittedAnswer(question, item, errors);
    if (parsed) answers.push(parsed);
  }

  for (const question of questions) {
    if (question.required && !seen.has(question.id)) {
      errors[question.id] = "Esta pregunta es obligatoria.";
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, value: { name, email, answers } };
}

function parseSubmittedAnswer(question, item, errors) {
  if (question.type === "single" || question.type === "dropdown") {
    if (!item.optionId) {
      if (question.required) errors[question.id] = "Elige una opción válida.";
      return null;
    }
    const option = (question.options || []).find((entry) => entry.id === item.optionId);
    if (!option) {
      errors[question.id] = "Elige una opción válida.";
      return null;
    }
    return { questionId: question.id, optionId: option.id };
  }
  if (question.type === "multiple") {
    const rawIds = Array.isArray(item.optionIds) ? item.optionIds : [];
    const unique = [...new Set(rawIds)];
    const allowed = new Set((question.options || []).map((entry) => entry.id));
    if (!unique.length) {
      if (question.required) errors[question.id] = "Elige al menos una opción.";
      return null;
    }
    if (unique.some((id) => !allowed.has(id))) {
      errors[question.id] = "Elige opciones válidas.";
      return null;
    }
    return { questionId: question.id, optionIds: unique };
  }
  if (question.type === "scale" || question.type === "rating") {
    if (item.scaleValue == null || item.scaleValue === "") {
      if (question.required) errors[question.id] = "Elige un valor de 1 a 5.";
      return null;
    }
    const value = Number(item.scaleValue);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      errors[question.id] = "Elige un valor de 1 a 5.";
      return null;
    }
    return { questionId: question.id, scaleValue: value };
  }
  if (question.type === "yes_no") {
    const value = String(item.text || "").trim().toLowerCase();
    const answer = value === "sí" || value === "si" ? "sí" : value === "no" ? "no" : "";
    if (!answer) {
      if (question.required || value) errors[question.id] = "Elige sí o no.";
      return null;
    }
    return { questionId: question.id, text: answer };
  }
  const limit = question.type === "long_text" ? LIMITS.long : question.type === "email" ? LIMITS.email : LIMITS.short;
  const value = storedFieldText(question.type, item.text);
  if (value.length > limit) {
    errors[question.id] = `El texto admite hasta ${limit} caracteres.`;
    return null;
  }
  if (!value) {
    if (question.required) errors[question.id] = "Esta pregunta es obligatoria.";
    return null;
  }
  const format = fieldError(question.type, value);
  if (format) {
    errors[question.id] = format;
    return null;
  }
  return { questionId: question.id, text: value };
}

export function validateIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) return "";
  return key;
}

export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 10 || value.length > 128) return "Usa entre 10 y 128 caracteres.";
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value) || !/\d/.test(value)) {
    return "Incluye al menos una letra y un número.";
  }
  return "";
}

export function validateEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > LIMITS.email) return "";
  return value;
}
