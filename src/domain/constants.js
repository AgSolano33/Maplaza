export const MODALITIES = ["recruitment", "climate"];
export const FORM_STATUSES = ["draft", "published", "closed", "archived"];
export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single",
  "dropdown",
  "multiple",
  "yes_no",
  "scale",
  "rating",
  "email",
  "phone",
  "number",
  "date",
  "time",
  "url",
];
export const REVIEW_STATUSES = ["pending", "interview", "hired", "rejected"];
export const FOLLOW_SITUATIONS = ["active", "exited"];
export const MIN_CLIMATE_SAMPLE = 5;

export const MODALITY_LABELS = {
  recruitment: "Evaluación de candidaturas",
  climate: "Encuesta de área",
};

export const STATUS_LABELS = {
  draft: "Borrador",
  published: "Publicado",
  closed: "Cerrado",
  archived: "Archivado",
};

export const REVIEW_LABELS = {
  pending: "Pendiente",
  interview: "Entrevista",
  hired: "Contratado",
  rejected: "No seleccionado",
};

export const SITUATION_LABELS = {
  active: "Activo",
  exited: "Salida",
};

export const QUESTION_LABELS = {
  single: "Opción única",
  scale: "Escala de 1 a 5",
  short_text: "Texto corto",
  long_text: "Texto largo",
  email: "Correo",
  phone: "Teléfono",
  number: "Número",
  date: "Fecha",
  dropdown: "Lista",
  multiple: "Varias opciones",
  yes_no: "Sí o no",
  rating: "Estrellas",
  time: "Hora",
  url: "Enlace",
};

export const EXIT_REASON_SUGGESTIONS = [
  "Mejor salario",
  "Horarios",
  "Ambiente laboral",
  "Desarrollo profesional",
  "Motivos personales",
  "Otro / sin especificar",
];

export const DEFAULT_SCALE_LABELS = [
  "Muy en desacuerdo",
  "En desacuerdo",
  "Neutral",
  "De acuerdo",
  "Muy de acuerdo",
];

export const LIMITS = {
  title: 140,
  description: 2000,
  instructions: 2000,
  confirmation: 1000,
  role: 140,
  prompt: 1000,
  option: 300,
  scaleLabel: 80,
  short: 300,
  long: 4000,
  name: 120,
  email: 200,
  notes: 5000,
  catalog: 80,
  reason: 160,
  idempotency: 80,
};
