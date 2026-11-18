export function shuffleOrder(questions) {
  const order = {};
  for (const question of questions || []) {
    if (!question?.shuffleOptions) continue;
    order[question.id] = shuffle((question.options || []).map((option) => option.id));
  }
  return order;
}

export function orderedOptions(question, order) {
  const options = question?.options || [];
  if (!question?.shuffleOptions || !Array.isArray(order) || order.length === 0) return options;
  const byId = new Map(options.map((option) => [option.id, option]));
  const sorted = order.map((id) => byId.get(id)).filter(Boolean);
  const extra = options.filter((option) => !order.includes(option.id));
  return [...sorted, ...extra];
}

function shuffle(ids) {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
