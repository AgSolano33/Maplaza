const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function storedImage(value, max) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (isCloudinaryImage(text)) return text;
  if (DATA_IMAGE.test(text) && text.length <= max) return text;
  return "";
}

export function isCloudinaryImage(value) {
  const text = String(value || "");
  if (!text || text.length > 800) return false;
  try {
    const url = new URL(text);
    return url.protocol === "https:"
      && url.hostname === "res.cloudinary.com"
      && !url.search
      && !url.hash
      && url.pathname.includes("/image/upload/");
  } catch {
    return false;
  }
}

export function matchesCloudinaryAccount(value, cloud) {
  if (!isCloudinaryImage(value) || !/^[\w-]+$/.test(cloud || "")) return false;
  return new URL(value).pathname.startsWith(`/${cloud}/image/upload/`);
}
