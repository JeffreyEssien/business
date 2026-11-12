/**
 * Responsive delivery for Cloudinary images. Inserts a transformation into a Cloudinary
 * "upload" URL so visitors download a right-sized, modern-format file (f_auto, q_auto)
 * instead of the original upload. Non-Cloudinary URLs are returned unchanged.
 */
const uploadSegment = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

type Crop = { width: number; aspect?: number };

export function cloudinaryImage(url: string, { width, aspect }: Crop) {
  const match = url.match(uploadSegment);
  if (!match) return url;
  const parts = ['f_auto', 'q_auto', `w_${Math.round(width)}`];
  // Fixed-shape crops use automatic gravity, which keeps faces and subjects in frame.
  if (aspect) parts.push(`ar_${aspect.toFixed(3)}`, 'c_fill', 'g_auto');
  else parts.push('c_limit');
  return `${match[1]}${parts.join(',')}/${match[2]}`;
}

/** A srcSet of widths for the same crop, so browsers choose the smallest that fits. */
export function cloudinarySrcSet(url: string, widths: number[], aspect?: number) {
  if (!uploadSegment.test(url)) return undefined;
  return widths.map((width) => `${cloudinaryImage(url, { width, aspect })} ${width}w`).join(', ');
}
