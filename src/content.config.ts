import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    cover_image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    name: z.string().optional(),
    birth_date: z.string().optional(),
    gender: z.string().optional(),
    birth_hour: z.coerce.number().optional(),
  }),
});

export const collections = { blog };
