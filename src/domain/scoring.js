function roundDisplay(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

export function formatScore(value) {
  const rounded = roundDisplay(value);
  return rounded == null ? "Sin puntuación" : String(rounded);
}

function questionMaximum(question) {
  const scores = (question.options || [])
    .map((option) => option.score)
    .filter((score) => typeof score === "number" && !Number.isNaN(score));
  if (!scores.length) return 0;
  return Math.max(...scores);
}

/**
 * Cada pregunta evaluada aporta su opción más alta al máximo posible.
 * El puntaje de la persona es lo que obtuvo entre la suma de esos máximos.
 * Una pregunta de 40 y otra de 5 dan un máximo de 45, no el mismo peso cada una.
 */
export function scoreRecruitment(questions, answers) {
  const answerByQuestion = new Map(
    (answers || []).map((answer) => [answer.questionId, answer]),
  );
  const buckets = new Map();
  let earned = 0;
  let possible = 0;

  for (const question of questions || []) {
    if (question.type !== "single") continue;
    if (!question.competencyId && !question.competencyName) continue;
    const maximum = questionMaximum(question);
    if (maximum <= 0) continue;
    const selected = answerByQuestion.get(question.id);
    const option = (question.options || []).find((item) => item.id === selected?.optionId);
    const points = option && typeof option.score === "number" && !Number.isNaN(option.score) ? option.score : 0;

    const key = String(question.competencyId || question.competencyName);
    if (!buckets.has(key)) {
      buckets.set(key, {
        competencyId: question.competencyId || null,
        name: question.competencyName || "Competencia",
        earned: 0,
        possible: 0,
        count: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.earned += points;
    bucket.possible += maximum;
    bucket.count += 1;
    earned += points;
    possible += maximum;
  }

  const competencies = [];
  for (const bucket of buckets.values()) {
    if (bucket.possible <= 0) continue;
    competencies.push({
      competencyId: bucket.competencyId,
      name: bucket.name,
      averageRaw: bucket.earned,
      scorePercent: (bucket.earned / bucket.possible) * 100,
      questionCount: bucket.count,
    });
  }

  const globalScore = possible > 0 ? (earned / possible) * 100 : null;
  return { competencies, globalScore };
}
