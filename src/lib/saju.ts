export const CHEONGAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const JIJI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;

const CHEONGAN_OHANG: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토", 경: "금", 신: "금", 임: "수", 계: "수",
};
const JIJI_OHANG: Record<string, string> = {
  자: "수", 축: "토", 인: "목", 묘: "목", 진: "토", 사: "화", 오: "화", 미: "토", 신: "금", 유: "금", 술: "토", 해: "수",
};
const CHEONGAN_EUYANG: Record<string, string> = {
  갑: "양", 을: "음", 병: "양", 정: "음", 무: "양", 기: "음", 경: "양", 신: "음", 임: "양", 계: "음",
};
const OHANG_RELATIONS: Record<string, string> = {
  "목-목": "비겁", "목-화": "식상", "목-토": "재성", "목-금": "관성", "목-수": "인성",
  "화-화": "비겁", "화-토": "식상", "화-금": "재성", "화-수": "관성", "화-목": "인성",
  "토-토": "비겁", "토-금": "식상", "토-수": "재성", "토-목": "관성", "토-화": "인성",
  "금-금": "비겁", "금-수": "식상", "금-목": "재성", "금-화": "관성", "금-토": "인성",
  "수-수": "비겁", "수-목": "식상", "수-화": "재성", "수-토": "관성", "수-금": "인성",
};
const SIPSUNG_DETAIL: Record<string, string> = {
  "비겁-same": "비견", "비겁-diff": "겁재",
  "식상-same": "식신", "식상-diff": "상관",
  "재성-same": "편재", "재성-diff": "정재",
  "관성-same": "편관", "관성-diff": "정관",
  "인성-same": "편인", "인성-diff": "정인",
};
const JEOLGI_MONTH = [
  [1, 6, 1], [2, 4, 2], [3, 6, 3], [4, 5, 4],
  [5, 6, 5], [6, 6, 6], [7, 7, 7], [8, 8, 8],
  [9, 8, 9], [10, 8, 10], [11, 7, 11], [12, 7, 12],
] as const;
const MONTH_TO_JIJI_IDX: Record<number, number> = {
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 0, 12: 1,
};

export type Pillar = {
  천간: string;
  지지: string;
  천간_오행: string;
  지지_오행: string;
};

export type SajuResult = {
  생년월일시: string;
  성별: string;
  일간: string;
  일주_요약: string;
  일주_강약: string;
  용신: string;
  사주_기둥: { 연주: Pillar; 월주: Pillar; 일주: Pillar; 시주: Pillar };
  오행_분석: { count: Record<string, number>; ratio: Record<string, number> };
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getYearGanzhi(year: number): [string, string] {
  const idx = (year - 4) % 60;
  return [CHEONGAN[idx % 10], JIJI[idx % 12]];
}

function getMonthGanzhi(monthNum: number, yearGan: string): [string, string] {
  const jijiIdx = MONTH_TO_JIJI_IDX[monthNum];
  const yearGanIdx = CHEONGAN.indexOf(yearGan as (typeof CHEONGAN)[number]);
  const startMap: Record<number, number> = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
  const startIdx = startMap[yearGanIdx % 10];
  return [CHEONGAN[(startIdx + ((monthNum - 1) % 12)) % 10], JIJI[jijiIdx]];
}

function getDayGanzhi(year: number, month: number, day: number): [string, string] {
  const base = Date.UTC(1900, 0, 1);
  const target = Date.UTC(year, month - 1, day);
  const delta = Math.round((target - base) / 86400000);
  const idx = (10 + delta) % 60;
  return [CHEONGAN[idx % 10], JIJI[idx % 12]];
}

function getHourGanzhi(hour: number, dayGan: string): [string, string] {
  const hourJijiIdx = Math.floor((hour + 1) / 2) % 12;
  const dayGanIdx = CHEONGAN.indexOf(dayGan as (typeof CHEONGAN)[number]);
  const startMap: Record<number, number> = { 0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8 };
  return [CHEONGAN[(startMap[dayGanIdx % 10] + hourJijiIdx) % 10], JIJI[hourJijiIdx]];
}

function getJeolgiMonthNum(year: number, month: number, day: number): number {
  const found = JEOLGI_MONTH.find((row) => row[0] === month) || [month, 6, month];
  let num = found[2];
  if (day < found[1]) num = ((num - 2) % 12) + 1;
  return num;
}

function pillar(gan: string, ji: string): Pillar {
  return { 천간: gan, 지지: ji, 천간_오행: CHEONGAN_OHANG[gan], 지지_오행: JIJI_OHANG[ji] };
}

function ohangRatio(pillars: Array<[string, string]>) {
  const count = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const [gan, ji] of pillars) {
    count[CHEONGAN_OHANG[gan] as keyof typeof count] += 1;
    count[JIJI_OHANG[ji] as keyof typeof count] += 1;
  }
  const total = 8;
  const ratio = Object.fromEntries(Object.entries(count).map(([k, v]) => [k, Math.round((v / total) * 1000) / 10]));
  return { count, ratio };
}

export function calculateSaju(input: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  gender?: string;
}): SajuResult {
  const hour = input.hour ?? 12;
  const gender = input.gender === "여" ? "여" : "남";
  const [yearGan, yearJi] = getYearGanzhi(input.year);
  const jeolgi = getJeolgiMonthNum(input.year, input.month, input.day);
  const [monthGan, monthJi] = getMonthGanzhi(jeolgi, yearGan);
  const [dayGan, dayJi] = getDayGanzhi(input.year, input.month, input.day);
  const [hourGan, hourJi] = getHourGanzhi(hour, dayGan);
  const pillars: Array<[string, string]> = [
    [yearGan, yearJi],
    [monthGan, monthJi],
    [dayGan, dayJi],
    [hourGan, hourJi],
  ];
  const ohang = ohangRatio(pillars);
  const weakest = Object.entries(ohang.count).sort((a, b) => a[1] - b[1])[0][0];
  return {
    생년월일시: `${input.year}년 ${input.month}월 ${input.day}일 ${hour}시`,
    성별: gender,
    일간: dayGan,
    일주_요약: `${dayGan}${dayJi}일주`,
    일주_강약: ohang.count.목 + ohang.count.수 >= 4 ? "신강" : "신약",
    용신: `${weakest}(보완)`,
    사주_기둥: {
      연주: pillar(yearGan, yearJi),
      월주: pillar(monthGan, monthJi),
      일주: pillar(dayGan, dayJi),
      시주: pillar(hourGan, hourJi),
    },
    오행_분석: ohang,
  };
}

export function relationOf(ilgan: string, other: string): string {
  const key = `${CHEONGAN_OHANG[ilgan]}-${CHEONGAN_OHANG[other]}`;
  const base = OHANG_RELATIONS[key] || "비겁";
  const same = CHEONGAN_EUYANG[ilgan] === CHEONGAN_EUYANG[other] ? "same" : "diff";
  return SIPSUNG_DETAIL[`${base}-${same}`] || base;
}

export function gunghapScore(a: SajuResult, b: SajuResult): { score: number; label: string; notes: string[] } {
  const rel = relationOf(a.일간, b.일간);
  const relScore: Record<string, number> = {
    비견: 72, 겁재: 64, 식신: 86, 상관: 70, 편재: 78, 정재: 88, 편관: 60, 정관: 84, 편인: 74, 정인: 82,
  };
  let score = relScore[rel] ?? 70;
  const notes = [`일간 관계: ${a.일간}–${b.일간} (${rel})`];
  const shared = Object.keys(a.오행_분석.count).filter(
    (el) => a.오행_분석.count[el] > 0 && b.오행_분석.count[el] > 0,
  );
  if (shared.length >= 4) {
    score += 6;
    notes.push("오행이 많이 겹쳐 호흡이 잘 맞습니다.");
  } else if (shared.length <= 2) {
    score -= 6;
    notes.push("오행 편차가 있어 서로 보완이 필요합니다.");
  }
  score = Math.max(42, Math.min(96, score));
  const label = score >= 85 ? "잘 맞는 편" : score >= 70 ? "무난한 편" : score >= 55 ? "노력하면 좋은 편" : "차이가 있는 편";
  return { score, label, notes };
}

export function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}
