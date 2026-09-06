/**
 * Converts a title string into a URL-friendly slug
 * e.g., "Solo Leveling: Ragnarok (Season 2)" -> "solo-leveling-ragnarok-season-2"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
