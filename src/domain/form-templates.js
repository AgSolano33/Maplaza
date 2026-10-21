import { DEFAULT_SCALE_LABELS } from "./constants.js";

const SCALE = [...DEFAULT_SCALE_LABELS];

export const FORM_TEMPLATES = [
  {
    id: "situacional",
    modality: "recruitment",
    category: "Evaluación",
    title: "Evaluación situacional",
    description: "Escenarios de trabajo para ver cómo actuaría una persona candidata antes de entrar a la empresa.",
    minutes: "8–12 min",
    questions: [
      {
        type: "single",
        prompt: "Cuando hay diferencias en el equipo sobre cómo hacer una tarea, ¿qué haces?",
        required: true,
        competencyName: "Trabajo en equipo",
        options: [
          { label: "Escucho todas las opiniones y busco un punto medio que funcione para todos.", score: 5 },
          { label: "Propongo analizar las opciones y decidir en conjunto con base en los objetivos.", score: 4 },
          { label: "Trato de convencer al equipo de mi punto de vista.", score: 2 },
          { label: "Dejo que otra persona tome la decisión para evitar el conflicto.", score: 0 },
        ],
      },
      {
        type: "single",
        prompt: "Tu equipo tiene una entrega urgente. ¿Qué harías?",
        required: true,
        competencyName: "Responsabilidad",
        options: [
          { label: "Organizo el trabajo, priorizo las tareas y comunico el plan.", score: 5 },
          { label: "Me enfoco en mi parte y la termino lo antes posible.", score: 3 },
          { label: "Pido apoyo para reasignar recursos.", score: 2 },
          { label: "Espero a ver qué hacen los demás.", score: 0 },
        ],
      },
      {
        type: "long_text",
        prompt: "¿Qué podríamos hacer como equipo para mejorar nuestra colaboración?",
        required: false,
      },
    ],
  },
  {
    id: "criterio",
    modality: "recruitment",
    category: "Evaluación",
    title: "Criterio en la operación",
    description: "Preguntas para revisar responsabilidad y adaptación de una persona candidata.",
    minutes: "6–10 min",
    questions: [
      {
        type: "single",
        prompt: "Detectas un error antes de entregar un trabajo. ¿Cómo actúas?",
        required: true,
        competencyName: "Responsabilidad",
        options: [
          { label: "Detengo el proceso y reporto el error siguiendo el procedimiento.", score: 5 },
          { label: "Pregunto qué hacer antes de continuar.", score: 4 },
          { label: "Lo dejo pasar si parece pequeño.", score: 1 },
          { label: "Espero a que otra persona lo descubra.", score: 0 },
        ],
      },
      {
        type: "single",
        prompt: "Cambia la forma de registrar el trabajo. ¿Qué haces?",
        required: true,
        competencyName: "Adaptabilidad",
        options: [
          { label: "Aprendo el procedimiento y comunico dudas concretas.", score: 5 },
          { label: "Pido que me expliquen cómo aplicarlo.", score: 4 },
          { label: "Sigo con la forma anterior sin comentarlo.", score: 1 },
          { label: "Evito usar el registro nuevo.", score: 0 },
        ],
      },
    ],
  },
  {
    id: "clima-area",
    modality: "climate",
    category: "Encuesta",
    title: "Clima del área",
    description: "Encuesta anónima para conocer comunicación, confianza y reparto del trabajo en un área.",
    minutes: "5–8 min",
    questions: [
      { type: "scale", prompt: "En mi área, las personas se comunican con claridad.", required: true, scaleLabels: SCALE },
      { type: "scale", prompt: "Puedo decir lo que pienso sin que se use en mi contra.", required: true, scaleLabels: SCALE },
      { type: "scale", prompt: "El trabajo se reparte de forma justa.", required: true, scaleLabels: SCALE },
      { type: "long_text", prompt: "¿Qué debería mejorar en el área?", required: false },
    ],
  },
  {
    id: "comunicacion",
    modality: "climate",
    category: "Encuesta",
    title: "Comunicación del área",
    description: "Escalas anónimas sobre la información que recibe el equipo para hacer su trabajo.",
    minutes: "4–6 min",
    questions: [
      { type: "scale", prompt: "Recibo la información que necesito para hacer mi trabajo.", required: true, scaleLabels: SCALE },
      { type: "scale", prompt: "Las indicaciones de mi área son claras.", required: true, scaleLabels: SCALE },
      { type: "scale", prompt: "Cuando hay un problema, sé a quién acudir.", required: true, scaleLabels: SCALE },
    ],
  },
];

export function materializeTemplate(template, competencies = []) {
  return template.questions.map((question) => ({
    id: crypto.randomUUID(),
    type: question.type,
    prompt: question.prompt,
    required: question.required !== false,
    competencyId: matchCompetency(question.competencyName, competencies),
    options: (question.options || []).map((option) => ({
      id: crypto.randomUUID(),
      label: option.label,
      score: typeof option.score === "number" ? option.score : 0,
    })),
    scaleLabels: question.scaleLabels?.length === 5 ? [...question.scaleLabels] : [...SCALE],
  }));
}

function matchCompetency(name, competencies) {
  if (!name) return "";
  const wanted = name.trim().toLowerCase();
  const matches = competencies.filter((item) => item.name?.trim().toLowerCase() === wanted);
  return (matches.find((item) => item.active) || matches[0])?.id || "";
}
