export const site = {
  name: "사주언니 안나의 집",
  title: "사주언니 안나의 집",
  brandName: "안나의 집",
  description: "유명인의 사주와 운세를 한곳에서 찾아보는 안나의 집입니다.",
  baseUrl: "https://annahouse.co.kr",
  lang: "ko",
  mediaBaseUrl: "https://pub-4d97094276754b65903a7f773113ed64.r2.dev",
} as const;

export function media(path: string): string {
  const cleaned = path.replace(/^\//, "");
  const base = site.mediaBaseUrl.replace(/\/$/, "");
  if (base) return `${base}/${cleaned}`;
  return `/${cleaned}`;
}

export function mediaUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return media(path);
}
