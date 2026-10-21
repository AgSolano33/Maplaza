export function parseDay(value, end = false) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
}
