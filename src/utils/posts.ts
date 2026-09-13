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
