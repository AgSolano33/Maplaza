export function tenureDays(start, end, now = new Date()) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : now;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
  return days < 0 ? null : days;
}

export function summarizeFollowUps(rows, now = new Date()) {
  const decorated = rows.map((row) => ({
    ...row,
    tenureDays: tenureDays(row.startDate, row.situation === "exited" ? row.exitDate : null, now),
  }));
  const active = decorated.filter((row) => row.situation === "active");
  const exited = decorated.filter((row) => row.situation === "exited");
  const averageDays = (list) =>
    list.length ? list.reduce((total, row) => total + (row.tenureDays || 0), 0) / list.length : null;
  const averageScore = (list) => {
    const scores = list.map((row) => row.globalScore).filter((score) => score != null);
    return scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
  };
  const reasons = new Map();
  for (const row of exited) {
    const reason = row.exitReason || "Sin especificar";
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
  }

  return {
    total: decorated.length,
    active: active.length,
    exited: exited.length,
    averageTenureDaysActive: averageDays(active),
    averageTenureDaysExited: averageDays(exited),
    averageScoreActive: averageScore(active),
    averageScoreExited: averageScore(exited),
    reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })),
    rows: decorated,
    notice:
      "Estas cifras describen lo registrado. No predicen una renuncia ni autorizan una contratación o un rechazo automáticos.",
  };
}
