export function describeAnswer(question, answer) {
  if (!question) return { prompt: "Pregunta", value: "Sin respuesta" };
  if (!answer) return { prompt: question.prompt || "Pregunta", value: "Sin respuesta" };
  if (question.type === "single" || question.type === "dropdown") {
    const option = (question.options || []).find((item) => item.id === answer.optionId);
    return { prompt: question.prompt, value: option?.label || "Opción no disponible" };
  }
  if (question.type === "multiple") {
    const labels = (question.options || [])
      .filter((item) => (answer.optionIds || []).includes(item.id))
      .map((item) => item.label);
    return { prompt: question.prompt, value: labels.length ? labels.join(", ") : "Sin respuesta" };
  }
  if (question.type === "scale" || question.type === "rating") {
    return { prompt: question.prompt, value: answer.scaleValue ? `${answer.scaleValue} de 5` : "Sin respuesta" };
  }
  if (question.type === "yes_no") {
    if (answer.text === "sí") return { prompt: question.prompt, value: "Sí" };
    if (answer.text === "no") return { prompt: question.prompt, value: "No" };
    return { prompt: question.prompt, value: "Sin respuesta" };
  }
  return { prompt: question.prompt, value: answer.text || "Sin respuesta" };
}
