import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;

export function postSlug(post: Post): string {
  return post.data.slug || post.id.replace(/\.mdx?$/, "");
}

export function postUrl(post: Post): string {
  return `/${postSlug(post)}/`;
}

export async function getBlogPosts(): Promise<Post[]> {
  try {
    const posts = await getCollection("blog");
    return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  } catch {
    return [];
  }
}

export function isSajuPost(post: Post): boolean {
  if (post.data.legacy) return false;
  return Boolean(post.data.name) || post.data.title.includes("사주") || postSlug(post).includes("사주");
}

export async function getSajuPosts(): Promise<Post[]> {
  return (await getBlogPosts()).filter(isSajuPost);
}

const GENERIC_SAJU_TAG = /^(사주|연예인|만세력|사주 명리학|연예인 사주|신강|신약|.+기운 사주|.+\s사주|.+\s운세)$/;
const SAJU_GROUPS = ["코르티스", "투모로우바이투게더", "르센느"];
const SAJU_CLUSTERS = [["정몽규", "홍명보", "설영우"]];

function sajuGroup(post: Post): string {
  const hay = `${postSlug(post)} ${post.data.title} ${post.data.description}`;
  return SAJU_GROUPS.find((group) => hay.includes(group)) || "";
}

function sajuCluster(post: Post): string {
  const name = (post.data.name || "").trim();
  const hay = `${name} ${postSlug(post)} ${post.data.title}`;
  const cluster = SAJU_CLUSTERS.find((names) => names.some((item) => hay.includes(item)));
  return cluster ? cluster.join("|") : "";
}

function sajuSignalTags(post: Post): string[] {
  return post.data.tags.filter((tag) => !GENERIC_SAJU_TAG.test(tag));
}

export function relatedSajuPosts(current: Post, posts: Post[], limit = 3): Post[] {
  const currentSlug = postSlug(current);
  const currentName = (current.data.name || "").trim();
  const currentGroup = sajuGroup(current);
  const currentCluster = sajuCluster(current);
  const currentSignals = new Set(sajuSignalTags(current));
  const seen = new Set<string>([currentSlug, currentName].filter(Boolean));

  const ranked = posts
    .filter((post) => {
      const slug = postSlug(post);
      const name = (post.data.name || "").trim();
      if (slug === currentSlug) return false;
      if (name && seen.has(name)) return false;
      return true;
    })
    .map((post) => {
      let score = 0;
      if (currentGroup && sajuGroup(post) === currentGroup) score += 100;
      if (currentCluster && sajuCluster(post) === currentCluster) score += 80;
      score += sajuSignalTags(post).filter((tag) => currentSignals.has(tag)).length * 12;
      if (current.data.gender && post.data.gender === current.data.gender) score += 2;
      score += Math.max(0, 3 - Math.abs(post.data.date.valueOf() - current.data.date.valueOf()) / 86_400_000 / 30);
      return { post, score };
    })
    .sort((a, b) => b.score - a.score || b.post.data.date.valueOf() - a.post.data.date.valueOf());

  const picked: Post[] = [];
  for (const row of ranked) {
    const name = (row.post.data.name || "").trim();
    const slug = postSlug(row.post);
    if (seen.has(slug) || (name && seen.has(name))) continue;
    picked.push(row.post);
    seen.add(slug);
    if (name) seen.add(name);
    if (picked.length >= limit) break;
  }
  return picked;
}

export type Face = {
  name: string;
  href: string;
  image: string;
  title: string;
  description: string;
  date?: Date;
};

function toFace(post: Post): Face {
  return {
    name: (post.data.name || "").trim(),
    href: postUrl(post),
    image: post.data.cover_image || "",
    title: post.data.title,
    description: post.data.description,
    date: post.data.date,
  };
}

export function celebrityFaces(posts: Post[], popularSlugs: string[] = []): Face[] {
  const bySlug = new Map(posts.map((post) => [postSlug(post), post]));
  const seen = new Set<string>();
  const faces: Face[] = [];

  for (const slug of popularSlugs) {
    const post = bySlug.get(slug);
    const name = post?.data.name?.trim();
    if (!post || !name || seen.has(name)) continue;
    seen.add(name);
    faces.push(toFace(post));
  }

  for (const post of posts) {
    const name = (post.data.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    faces.push(toFace(post));
  }
  return faces;
}

export function popularCards(posts: Post[], popularSlugs: string[], limit = 6): Face[] {
  const faces = celebrityFaces(posts, popularSlugs);
  const picked = faces.slice(0, limit);
  return picked;
}

export function authorUrl(slug: string, page = 1): string {
  if (page <= 1) return `/author/${slug}/page/1/`;
  return `/author/${slug}/page/${page}/`;
}

export const TAG_PAGE_SIZE = 10;

export function tagSlug(name: string): string {
  return name.trim().replace(/\+/g, "").replace(/[()]/g, "").replace(/\s+/g, "-");
}

export function tagUrl(slug: string, page = 1): string {
  if (page <= 1) return `/tag/${slug}/`;
  return `/tag/${slug}/page/${page}/`;
}

export function collectTags(posts: Post[]): { slug: string; name: string }[] {
  const map = new Map<string, string>();
  for (const post of posts) {
    for (const name of post.data.tags) {
      const slug = tagSlug(name);
      if (slug) map.set(slug, name);
    }
  }
  return [...map.entries()].map(([slug, name]) => ({ slug, name }));
}

export function postsWithTag(posts: Post[], name: string): Post[] {
  return posts.filter((post) => post.data.tags.includes(name));
}

export function paginatePosts<T>(items: T[], page: number, pageSize: number): {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function absoluteAssetUrl(path: string | undefined, baseUrl: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).href;
}
