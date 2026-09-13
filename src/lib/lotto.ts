export type LottoDraw = {
  no: number;
  date: string;
  numbers: number[];
  bonus: number;
};

export type LottoGame = {
  id: number;
  title: string;
  blurb: string;
  numbers: number[];
};

function seoulToday(now = new Date()): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return { year, month, day };
}

function parseDrawDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function weekOfMonth(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

function tally(draws: LottoDraw[], pred: (draw: LottoDraw) => boolean): number[] {
  const counts = Array.from({ length: 46 }, () => 0);
  for (const draw of draws) {
    if (!pred(draw)) continue;
    for (const n of draw.numbers) counts[n] += 1;
  }
  return counts;
}

function lastSeenIndex(draws: LottoDraw[]): number[] {
  const seen = Array.from({ length: 46 }, () => Number.POSITIVE_INFINITY);
  draws.forEach((draw, index) => {
    for (const n of draw.numbers) {
      if (!Number.isFinite(seen[n])) seen[n] = index;
    }
  });
  return seen;
}

function colderFirst(a: number, b: number, seen: number[]): number {
  return seen[b] - seen[a] || a - b;
}

function topByCount(counts: number[], seen: number[], take: number, preferHot = true): number[] {
  return Array.from({ length: 45 }, (_, i) => i + 1)
    .sort((a, b) => {
      const diff = preferHot ? counts[b] - counts[a] : counts[a] - counts[b];
      return diff || colderFirst(a, b, seen);
    })
    .slice(0, take);
}

function unusedNumbers(counts: number[]): number[] {
  return Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => counts[n] === 0);
}

function fillFromCold(picked: number[], seen: number[], rng = Math.random): number[] {
  const chosen = [...picked];
  const pool = Array.from({ length: 45 }, (_, i) => i + 1)
    .filter((n) => !chosen.includes(n))
    .sort((a, b) => colderFirst(a, b, seen));
  const cold = pool.slice(0, Math.max(12, 6 - chosen.length));
  while (chosen.length < 6 && cold.length) {
    const remain = cold.filter((n) => !chosen.includes(n));
    if (!remain.length) break;
    chosen.push(remain[Math.floor(rng() * remain.length)]);
  }
  while (chosen.length < 6 && pool.length) {
    const next = pool.find((n) => !chosen.includes(n));
    if (next == null) break;
    chosen.push(next);
  }
  return chosen.sort((a, b) => a - b);
}

function takeSix(candidates: number[], seen: number[], rng = Math.random): number[] {
  const unique = [...new Set(candidates)].filter((n) => n >= 1 && n <= 45);
  if (unique.length >= 6) {
    return unique.sort((a, b) => colderFirst(a, b, seen)).slice(0, 6).sort((a, b) => a - b);
  }
  return fillFromCold(unique, seen, rng);
}

export function ballClass(n: number): string {
  if (n <= 10) return "ball-y";
  if (n <= 20) return "ball-b";
  if (n <= 30) return "ball-r";
  if (n <= 40) return "ball-g";
  return "ball-n";
}

export function formatKoDate(iso: string): string {
  const { year, month, day } = parseDrawDate(iso);
  return `${year}년 ${month}월 ${day}일`;
}

export function recommendLottoGames(
  draws: LottoDraw[],
  now = new Date(),
  rng = Math.random,
): { games: LottoGame[]; latest: LottoDraw | null } {
  const latest = draws[0] || null;
  const today = seoulToday(now);
  const month = today.month;
  const week = weekOfMonth(today.day);
  const seen = lastSeenIndex(draws);
  const from = new Date(Date.UTC(today.year, today.month - 1, today.day));
  from.setUTCMonth(from.getUTCMonth() - 3);
  const fromKey = from.toISOString().slice(0, 10);

  const monthCounts = tally(draws, (d) => parseDrawDate(d.date).month === month);
  const weekCounts = tally(draws, (d) => {
    const date = parseDrawDate(d.date);
    return date.month === month && weekOfMonth(date.day) === week;
  });
  const recentCounts = tally(draws, (d) => d.date >= fromKey);

  const game1 = topByCount(monthCounts, seen, 6).sort((a, b) => a - b);
  const game2 = topByCount(weekCounts, seen, 6).sort((a, b) => a - b);
  const game3 = takeSix(unusedNumbers(monthCounts), seen, rng);
  const game4 = takeSix(unusedNumbers(weekCounts), seen, rng);
  const hot3 = topByCount(recentCounts, seen, 3, true);
  const cold3 = topByCount(recentCounts, seen, 8, false).filter((n) => !hot3.includes(n)).slice(0, 3);
  const game5 = takeSix([...hot3, ...cold3], seen, rng);

  return {
    latest,
    games: [
      {
        id: 1,
        title: "1게임",
        blurb: "과거 기록 바탕으로 이번 달에 가장 많이 당첨된 숫자",
        numbers: game1,
      },
      {
        id: 2,
        title: "2게임",
        blurb: "과거 기록 바탕으로 이번 달 이번 주에 많이 당첨된 숫자",
        numbers: game2,
      },
      {
        id: 3,
        title: "3게임",
        blurb: "과거 기록 바탕으로 이번 달에 한 번도 안 나온 숫자",
        numbers: game3,
      },
      {
        id: 4,
        title: "4게임",
        blurb: "과거 기록 바탕으로 이번 달 이번 주에 한 번도 안 나온 숫자",
        numbers: game4,
      },
      {
        id: 5,
        title: "5게임",
        blurb: "최근 3개월간 가장 많이 나온 숫자 3개 + 가장 안 나온 숫자 3개 조합",
        numbers: game5,
      },
    ],
  };
}
