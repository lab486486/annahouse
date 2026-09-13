import type { APIRoute } from "astro";
import author from "../data/authors.json";
import { site } from "../site.config";
import {
  authorUrl,
  collectTags,
  getBlogPosts,
  paginatePosts,
  postsWithTag,
  postUrl,
  TAG_PAGE_SIZE,
  tagUrl,
} from "../utils/posts";

type SitemapUrl = {
  path: string;
  lastmod?: Date;
  changefreq?: string;
  priority?: string;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function loc(path: string): string {
  return new URL(path, site.baseUrl).href;
}

export const GET: APIRoute = async () => {
  const posts = await getBlogPosts();
  const newest = posts[0]?.data.date;
  const urls: SitemapUrl[] = [
    { path: "/", lastmod: newest, changefreq: "daily", priority: "1.0" },
    { path: "/about/", changefreq: "monthly", priority: "0.6" },
    { path: "/saju/", lastmod: newest, changefreq: "weekly", priority: "0.8" },
    { path: "/saju/blood/", changefreq: "monthly", priority: "0.5" },
    { path: "/saju/star/", changefreq: "monthly", priority: "0.5" },
    { path: "/saju/gunghap/", changefreq: "monthly", priority: "0.5" },
    { path: "/saju/manse/", changefreq: "monthly", priority: "0.5" },
    { path: "/lotto/", changefreq: "weekly", priority: "0.6" },
  ];

  for (const post of posts) {
    urls.push({
      path: postUrl(post),
      lastmod: post.data.date,
      changefreq: "monthly",
      priority: post.data.legacy ? "0.6" : "0.7",
    });
  }

  for (const tag of collectTags(posts)) {
    const tagged = postsWithTag(posts, tag.name);
    const listing = paginatePosts(tagged, 1, TAG_PAGE_SIZE);
    for (let page = 1; page <= listing.totalPages; page += 1) {
      urls.push({
        path: tagUrl(tag.slug, page),
        lastmod: tagged[0]?.data.date,
        changefreq: "weekly",
        priority: page === 1 ? "0.4" : "0.3",
      });
    }
  }

  const authorListing = paginatePosts(posts, 1, author.pageSize);
  for (let page = 1; page <= authorListing.totalPages; page += 1) {
    urls.push({
      path: authorUrl(author.slug, page),
      lastmod: newest,
      changefreq: "weekly",
      priority: page === 1 ? "0.4" : "0.3",
    });
  }

  const body = urls
    .map((entry) => {
      const bits = [`<url><loc>${loc(entry.path)}</loc>`];
      if (entry.lastmod) bits.push(`<lastmod>${isoDate(entry.lastmod)}</lastmod>`);
      if (entry.changefreq) bits.push(`<changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority) bits.push(`<priority>${entry.priority}</priority>`);
      bits.push("</url>");
      return bits.join("");
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
