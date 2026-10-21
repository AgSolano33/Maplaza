import assert from "node:assert/strict";
import test from "node:test";
import { fieldError, restrictInput, storedFieldText } from "../src/domain/fields.js";
import { normalizeDraft, validateSubmission } from "../src/domain/validators.js";

test("el correo, el teléfono y el número rechazan otro tipo de dato", () => {
  assert.equal(fieldError("email", "ana@empresa.com"), "");
  assert.equal(fieldError("email", "ana"), "Escribe un correo válido.");
  assert.equal(fieldError("phone", "55 1234 5678"), "");
  assert.equal(fieldError("phone", "abc"), "Escribe un teléfono de 8 a 15 dígitos.");
  assert.equal(fieldError("number", "12.5"), "");
  assert.equal(fieldError("number", "12a"), "Escribe solo un número.");
  assert.equal(fieldError("date", "2026-10-21"), "");
  assert.equal(fieldError("date", "2026-02-31"), "Elige una fecha válida.");
  assert.equal(fieldError("time", "09:30"), "");
  assert.equal(fieldError("time", "25:00"), "Elige una hora válida.");
  assert.equal(fieldError("url", "https://maplasa.example"), "");
  assert.equal(fieldError("url", "maplasa"), "Escribe un enlace que empiece por https://.");
});

test("al escribir se descartan letras en teléfono y número", () => {
  assert.equal(restrictInput("phone", "55abc-12"), "55-12");
  assert.equal(restrictInput("number", "12a.5b"), "12.5");
  assert.equal(storedFieldText("email", " Ana@Empresa.com "), "ana@empresa.com");
  assert.equal(restrictInput("time", "09h30"), "0930");
  assert.equal(restrictInput("url", "https://a b.com"), "https://ab.com");
});

test("lista, casillas, sí o no y estrellas se guardan con el formato correcto", () => {
  const draft = normalizeDraft({
    modality: "climate",
    title: "Prueba de tipos",
    questions: [
      { type: "dropdown", prompt: "Área", options: [{ label: "Uno" }, { label: "Dos" }] },
      { type: "multiple", prompt: "Temas", options: [{ label: "A" }, { label: "B" }] },
      { type: "yes_no", prompt: "¿Vienes?" },
      { type: "rating", prompt: "Nota" },
      { type: "url", prompt: "Web" },
      { type: "time", prompt: "Hora" },
    ],
  }, { strict: true });
  assert.equal(draft.ok, true);
  const questions = draft.value.questions;
  const good = validateSubmission(draft.value, {
    answers: [
      { questionId: questions[0].id, optionId: questions[0].options[0].id },
      { questionId: questions[1].id, optionIds: questions[1].options.map((option) => option.id) },
      { questionId: questions[2].id, text: "si" },
      { questionId: questions[3].id, scaleValue: 4 },
      { questionId: questions[4].id, text: "https://maplasa.example" },
      { questionId: questions[5].id, text: "09:30" },
    ],
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.answers[2].text, "sí");
  assert.deepEqual(good.value.answers[1].optionIds, questions[1].options.map((option) => option.id));

  const bad = validateSubmission(draft.value, {
    answers: [
      { questionId: questions[0].id, optionId: "no-existe" },
      { questionId: questions[1].id, optionIds: ["no-existe"] },
      { questionId: questions[2].id, text: "tal vez" },
      { questionId: questions[3].id, scaleValue: 6 },
      { questionId: questions[4].id, text: "no-es-enlace" },
      { questionId: questions[5].id, text: "25:00" },
    ],
  });
  assert.equal(bad.ok, false);
});
