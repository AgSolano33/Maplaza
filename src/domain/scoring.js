function roundDisplay(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

export function formatScore(value) {
  const rounded = roundDisplay(value);
  return rounded == null ? "Sin puntuación" : String(rounded);
}

/**
 * Puntuación por competencia = promedio de sus respuestas puntuables / 5 * 100.
 * La global es el promedio de esas competencias, con el mismo peso para cada una.
 * Las preguntas de texto y las que no tienen scoring quedan fuera.
 * Una competencia sin respuestas puntuables no se convierte en cero.
 */
export function scoreRecruitment(questions, answers) {
  const answerByQuestion = new Map(
    (answers || []).map((answer) => [answer.questionId, answer]),
  );
  const buckets = new Map();

  for (const question of questions || []) {
    if (question.type !== "single") continue;
    if (!question.competencyId && !question.competencyName) continue;
    const selected = answerByQuestion.get(question.id);
    if (!selected?.optionId) continue;
    const option = (question.options || []).find((item) => item.id === selected.optionId);
    if (!option || typeof option.score !== "number" || Number.isNaN(option.score)) continue;

    const key = String(question.competencyId || question.competencyName);
    if (!buckets.has(key)) {
      buckets.set(key, {
        competencyId: question.competencyId || null,
        name: question.competencyName || "Competencia",
        sum: 0,
        count: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.sum += option.score;
    bucket.count += 1;
  }

  const competencies = [];
  for (const bucket of buckets.values()) {
    if (bucket.count === 0) continue;
    const averageRaw = bucket.sum / bucket.count;
    competencies.push({
      competencyId: bucket.competencyId,
      name: bucket.name,
      averageRaw,
      scorePercent: (averageRaw / 5) * 100,
      questionCount: bucket.count,
    });
  }

  const globalScore = competencies.length
    ? competencies.reduce((total, item) => total + item.scorePercent, 0) / competencies.length
    : null;

  return { competencies, globalScore };
}
