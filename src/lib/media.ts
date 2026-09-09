const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const IMAGE_CDN =
  /(?:images\.unsplash\.com|plus\.unsplash\.com|cdn\.shopify\.com|imgix\.net|res\.cloudinary\.com|images\.pexels\.com|i\.pinimg\.com|media\.istockphoto\.com|googleusercontent\.com|twimg\.com\/media|imgur\.com\/[a-z0-9]+\.(?:jpe?g|png|gif|webp))/i;

/** True when a URL is likely a direct image (extension, common CDNs). */
export function looksLikeImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/i.test(url.protocol)) return false;
    const path = url.pathname.split("/").pop() || "";
    if (IMAGE_EXT.test(path)) return true;
    if (IMAGE_CDN.test(url.hostname + url.pathname)) return true;
    // Shopify / CDN style: .../files/.../photo.jpg?v=...
    if (IMAGE_EXT.test(url.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isImageContentType(contentType: string | null | undefined): boolean {
  return Boolean(contentType && /^image\//i.test(contentType.split(";")[0].trim()));
}
