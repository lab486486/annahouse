export const BLOOD_TYPES = ["A", "B", "O", "AB"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

const TABLE: Record<string, { score: number; blurb: string }> = {
  "A-A": { score: 78, blurb: "조심스럽고 배려가 겹칩니다. 말은 적어도 신뢰가 쌓입니다." },
  "A-B": { score: 62, blurb: "속도가 다릅니다. A는 준비, B는 즉흥이라 규칙만 맞으면 재미있습니다." },
  "A-O": { score: 80, blurb: "O가 길을 열고 A가 정리합니다. 역할이 나뉘면 편합니다." },
  "A-AB": { score: 70, blurb: "예민한 감각이 통합니다. 공간이 필요하니 너무 붙지 않는 게 좋습니다." },
  "B-B": { score: 74, blurb: "자유가 두 배입니다. 질투만 피하면 활기찬 짝입니다." },
  "B-O": { score: 76, blurb: "바깥으로 나가는 힘이 셉니다. 약속만 지키면 잘 맞습니다." },
  "B-AB": { score: 68, blurb: "둘 다 자기 세계가 있습니다. 간섭을 줄이면 오래 갑니다." },
  "O-O": { score: 82, blurb: "단순하고 솔직합니다. 큰 싸움은 잘 안 남습니다." },
  "O-AB": { score: 72, blurb: "O의 직선과 AB의 여운이 교차합니다. 번역이 필요합니다." },
  "AB-AB": { score: 69, blurb: "이해는 빠른데 실행이 느릴 수 있습니다. 일정을 밖으로 꺼내면 좋습니다." },
};

export function bloodGunghap(a: BloodType, b: BloodType) {
  const key = [a, b].sort().join("-");
  const found = TABLE[`${a}-${b}`] || TABLE[`${b}-${a}`] || TABLE[key];
  return found || { score: 70, blurb: "서로 다른 피가 만나면 익숙해지는 시간이 필요합니다." };
}
