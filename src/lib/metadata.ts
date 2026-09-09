import { isImageContentType, looksLikeImageUrl } from "@/lib/media";

function decode(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

function meta(html: string, key: string) {
  const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["']`, "i");
  const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
  return decode(propertyFirst.exec(html)?.[1] || contentFirst.exec(html)?.[1] || "");
}

function imageLinkMetadata(url: URL) {
  const leaf = decodeURIComponent(url.pathname.split("/").pop() || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return {
    title: leaf || url.hostname.replace(/^www\./, ""),
    image: url.toString(),
    description: "",
    price: null as number | null,
    currency: null as string | null,
    store: url.hostname.replace(/^www\./, ""),
    url: url.toString(),
    isImage: true as const,
  };
}

export async function getLinkMetadata(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Please use a regular http or https link.");
  if (looksLikeImageUrl(url.toString())) return imageLinkMetadata(url);

  const response = await fetch(url, { headers: { "User-Agent": "Petals link preview" }, signal: AbortSignal.timeout(6500), redirect: "follow" });
  const contentType = response.headers.get("content-type");
  if (isImageContentType(contentType)) return imageLinkMetadata(new URL(response.url || url.toString()));

  const html = await response.text();
  const title = meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || url.hostname;
  const image = meta(html, "og:image");
  const description = meta(html, "og:description") || meta(html, "description");
  const price = meta(html, "product:price:amount") || meta(html, "og:price:amount");
  const currency = meta(html, "product:price:currency") || meta(html, "og:price:currency");
  return { title: decode(title), image, description, price: price ? Number(price.replace(/[^0-9.]/g, "")) : null, currency: currency || null, store: url.hostname.replace(/^www\./, ""), url: url.toString() };
}
