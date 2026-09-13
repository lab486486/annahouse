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
