export const TAG_NUMBER_MAX_LENGTH = 5;

export function normalizeTagNumber(raw: string): string {
  return raw.trim().replace(/\D/g, '');
}

export function isValidTagNumber(tag: string): boolean {
  const normalized = normalizeTagNumber(tag);
  return normalized.length >= 1 && normalized.length <= TAG_NUMBER_MAX_LENGTH;
}

export function assertValidTagNumber(tag: string): string {
  const normalized = normalizeTagNumber(tag);
  if (!isValidTagNumber(normalized)) {
    throw new Error(`Student ID must be 1–${TAG_NUMBER_MAX_LENGTH} digits`);
  }
  return normalized;
}
