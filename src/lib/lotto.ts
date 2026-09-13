export type LottoDraw = {
  no: number;
  date: string;
  numbers: number[];
  bonus: number;
};

export type LottoPick = {
  number: number;
  reasons: string[];
};

function weekOfMonth(date: Date): number {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function tally(draws: LottoDraw[], pred: (draw: LottoDraw) => boolean): number[] {
  const counts = Array.from({ length: 46 }, () => 0);
  for (const draw of draws) {
    if (!pred(draw)) continue;
    for (const n of draw.numbers) counts[n] += 1;
  }
  return counts;
}

function pickWeighted(weights: number[], count: number, rng = Math.random): number[] {
  const chosen: number[] = [];
  const pool = weights.slice();
  while (chosen.length < count) {
    const total = pool.reduce((sum, w, i) => (i >= 1 && !chosen.includes(i) ? sum + Math.max(w, 0.2) : sum), 0);
    let cursor = rng() * total;
    let picked = 1;
    for (let i = 1; i <= 45; i += 1) {
      if (chosen.includes(i)) continue;
      cursor -= Math.max(pool[i], 0.2);
      if (cursor <= 0) {
        picked = i;
        break;
      }
    }
    chosen.push(picked);
  }
  return chosen.sort((a, b) => a - b);
}

export function recommendLotto(draws: LottoDraw[], now = new Date()): { picks: LottoPick[]; latest: LottoDraw | null } {
  const latest = draws[0] || null;
  const month = now.getMonth() + 1;
  const week = weekOfMonth(now);
  const monthCounts = tally(draws, (d) => new Date(d.date).getMonth() + 1 === month);
  const weekCounts = tally(draws, (d) => weekOfMonth(new Date(d.date)) === week);
  const recent = new Set(draws.slice(0, 10).flatMap((d) => d.numbers));
  const allCounts = tally(draws, () => true);

  const weights = Array.from({ length: 46 }, (_, n) => {
    if (n === 0) return 0;
    return 1 + monthCounts[n] * 0.35 + weekCounts[n] * 0.25 + allCounts[n] * 0.08 + (recent.has(n) ? 0 : 1.2);
  });

  const numbers = pickWeighted(weights, 6);
  const picks = numbers.map((number) => {
    const reasons: string[] = [];
    if (monthCounts[number] > 0) reasons.push(`${month}월 당첨 ${monthCounts[number]}회`);
    if (weekCounts[number] > 0) reasons.push(`이달 ${week}째 주에 ${weekCounts[number]}회`);
    if (!recent.has(number)) reasons.push("최근 10회 미출현");
    if (!reasons.length) reasons.push("전체 빈도 가중");
    return { number, reasons };
  });

  return { picks, latest };
}
