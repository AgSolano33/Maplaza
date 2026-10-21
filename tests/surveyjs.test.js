import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SCALE_LABELS } from "../src/domain/constants.js";
import { questionsFromSurvey, questionsToSurvey } from "../src/domain/surveyjs.js";

const competencyId = "6ad6bc0add127b551b897449";

function recruitmentQuestions() {
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      type: "single",
      prompt: "¿Cómo reacciona ante un imprevisto?",
      required: true,
      competencyId,
      options: [
        { id: "22222222-2222-4222-8222-222222222222", label: "Lo resuelve", score: 5 },
        { id: "33333333-3333-4333-8333-333333333333", label: "Lo escala", score: 1 },
      ],
      scaleLabels: [...DEFAULT_SCALE_LABELS],
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      type: "scale",
      prompt: "Nivel de acuerdo",
      required: false,
      competencyId: "",
      options: [],
      scaleLabels: ["Nada", "Poco", "Regular", "Bastante", "Total"],
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      type: "short_text",
      prompt: "Un ejemplo breve",
      required: false,
      competencyId: "",
      options: [],
      scaleLabels: [...DEFAULT_SCALE_LABELS],
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      type: "long_text",
      prompt: "Cuéntalo con detalle",
      required: true,
      competencyId: "",
      options: [],
      scaleLabels: [...DEFAULT_SCALE_LABELS],
    },
  ];
}

test("las preguntas de reclutamiento conservan ids, puntos y competencia", () => {
  const questions = recruitmentQuestions();
  assert.deepEqual(questionsFromSurvey(questionsToSurvey(questions), "recruitment"), questions);
});

test("varias páginas y paneles se aplanan en el orden original", () => {
  const json = {
    pages: [
      { elements: [{ type: "text", name: "texto-corto-1", title: "Primera", isRequired: false }] },
      {
        elements: [{
          type: "panel",
          elements: [{ type: "comment", name: "texto-largo-1", title: { es: "Segunda" }, isRequired: true }],
        }],
      },
    ],
  };
  const questions = questionsFromSurvey(json, "climate");
  assert.deepEqual(questions.map((question) => [question.type, question.prompt, question.required]), [
    ["short_text", "Primera", false],
    ["long_text", "Segunda", true],
  ]);
});

test("clima descarta puntos y competencia, y omite tipos ajenos", () => {
  const json = questionsToSurvey(recruitmentQuestions());
  json.pages[0].elements.push({ type: "checkbox", name: "casillas-extra", title: "No aplica", choices: ["A", "B"] });
  const questions = questionsFromSurvey(json, "climate");
  assert.equal(questions.length, 4);
  assert.equal(questions[0].competencyId, "");
  assert.deepEqual(questions[0].options.map((option) => option.score), [0, 0]);
  assert.equal(questions.some((question) => question.prompt === "No aplica"), false);
});
