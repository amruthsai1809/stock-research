export function mergePriceHistories(...histories) {
  const byDate = new Map();
  for (const history of histories) {
    for (const point of history ?? []) {
      if (point?.date) byDate.set(point.date, point);
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function trimHistoryYears(history, years) {
  if (!history.length) return [];
  const latest = new Date(`${history.at(-1).date}T00:00:00Z`);
  latest.setUTCFullYear(latest.getUTCFullYear() - years);
  const cutoff = latest.toISOString().slice(0, 10);
  return history.filter((point) => point.date >= cutoff);
}
