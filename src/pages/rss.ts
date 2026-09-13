import type { APIRoute } from "astro";
import { site } from "../site.config";
import { getBlogPosts, postUrl } from "../utils/posts";

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export const GET: APIRoute = async () => {
  const posts = await getBlogPosts();
  const feedUrl = new URL("/rss", site.baseUrl).href;
  const items = posts
    .map((post) => {
      const url = new URL(postUrl(post), site.baseUrl).href;
      return [
        "<item>",
        `<title>${cdata(post.data.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<pubDate>${post.data.date.toUTCString()}</pubDate>`,
        `<description>${cdata(post.data.description)}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `<channel>`,
    `<title>${cdata(site.title)}</title>`,
    `<link>${site.baseUrl}/</link>`,
    `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
    `<description>${cdata(site.description)}</description>`,
    `<language>ko</language>`,
    items,
    `</channel>`,
    `</rss>`,
  ].join("");

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
