/** P02-2 local-only limits and key validation. Never trust media names from JSON. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 24_000_000;
export const MAX_MEDIA_DIMENSION = 8192;
export const MAX_MODE_PHOTOS = 6;
export const MEDIA_UPLOAD_TTL_SECONDS = 30 * 60;
export const VALID_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validMediaId(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}
export function parsePhotoUpdate(input: unknown): { value: { expectedVersion: number; photoIds: string[] } } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid_photo_assignment' };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'expectedVersion,photoIds' ||
      !Number.isSafeInteger(value.expectedVersion) || Number(value.expectedVersion) < 1 ||
      !Array.isArray(value.photoIds) || value.photoIds.length > MAX_MODE_PHOTOS ||
      !value.photoIds.every(validMediaId) || new Set(value.photoIds).size !== value.photoIds.length) {
    return { error: 'invalid_photo_assignment' };
  }
  return { value: { expectedVersion: value.expectedVersion as number, photoIds: value.photoIds as string[] } };
}
export function validUploadBegin(input: unknown): boolean {
  return input !== null && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 0;
}
