import { getImage } from "astro:assets";

export async function optimizedMedia(
  src: string | undefined,
  width: number,
  height = width,
): Promise<string | undefined> {
  if (!src) return undefined;
  try {
    const image = await getImage({
      src,
      width,
      height,
      fit: "cover",
      format: "webp",
      quality: 70,
    });
    return image.src;
  } catch {
    return src;
  }
}
