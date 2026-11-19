// Photos people pick: every common kind, iPhones' HEIC included. A browser that can't
// show a HEIC itself (all but Safari) gets it converted first, with heic-to, which is
// big and so only fetched for one

// For <input type="file" accept>: by type and by extension (some browsers don't know
// HEIC's type, and would grey those files out otherwise)
export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

export const isHeic = (file) =>
  /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

// The picture as something an <img> can show here: the file itself, or a HEIC as a JPEG
export async function viewable(file) {
  if (!isHeic(file) || (await canShow(file))) return file;
  const { heicTo } = await import("heic-to");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
}

function canShow(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

// Uploads go through a host that takes at most 4.5 MB a request (Vercel): a bigger photo
// is made smaller here first, at most 2400 px on its long side, as WebP (or JPEG where the
// browser can't make WebP). The API makes its own copy from it either way
const UPLOAD_LIMIT = 3.5 * 1024 * 1024;
const UPLOAD_SIDE = 2400;

// Several photos in one request share that limit: pass a smaller `limit` and `side`
export async function shrinkForUpload(
  file,
  { limit = UPLOAD_LIMIT, side = UPLOAD_SIDE } = {},
) {
  if (file.size <= limit || /gif$/i.test(file.type)) return file;
  const bitmap = await createImageBitmap(await viewable(file));
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const encode = (type) =>
    new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
  let blob = await encode("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${ext}`,
    { type: blob.type },
  );
}
