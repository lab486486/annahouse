import type { APIRoute } from "astro";
import { site } from "../site.config";
import { getBlogPosts, postUrl } from "../utils/posts";

export const GET: APIRoute = async () => {
  const posts = await getBlogPosts();
  const items = posts
    .map((post) => {
      const url = new URL(postUrl(post), site.baseUrl).href;
      return `<item><title><![CDATA[${post.data.title}]]></title><link>${url}</link><guid>${url}</guid><pubDate>${post.data.date.toUTCString()}</pubDate><description><![CDATA[${post.data.description}]]></description></item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${site.title}</title><link>${site.baseUrl}</link><description>${site.description}</description>${items}</channel></rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
