/** P02-1 draft-only input policy. Bounded provisional text rules are not a public catalog. */
export type ProfileMode = 'dating' | 'friendship';
export type DraftFields = {
  displayName: string;
  bio: string;
  interests: string[];
  intention: string;
};
export type DraftInput = DraftFields & { expectedVersion: number };

const reservedHandles = new Set([
  'admin', 'administrator', 'support', 'help', 'official', 'moderator',
  'security', 'system', 'uluv', 'u_luv', 'null', 'undefined', 'root',
  'api', 'login', 'signup', 'account', 'dating', 'friendship', 'profile'
]);
const unsafeText = /[\p{Cc}\p{Cf}\u202a-\u202e\u2066-\u2069]/u;
const publicContact = /(?:https?:\/\/|www\.|(?<![\w])@[a-z0-9_]{3,}|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b(?:instagram|snapchat|telegram|whatsapp|signal|discord|wechat|facebook|tiktok|onlyfans)\b|(?:\+?\d[\s().-]*){8,}|\b(?:dm\s+me|text\s+me|call\s+me|contact\s+me|scan\s+(?:my\s+)?qr|follow\s+me)\b)/iu;

/** Handles are ASCII-only to avoid Unicode confusables and case-dependent aliases. */
export function normalizeHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(normalized) || reservedHandles.has(normalized)) return null;
  return normalized;
}

export function validPublicText(value: string): boolean {
  return !unsafeText.test(value) && !publicContact.test(value) && !/[<>]/u.test(value);
}

function cleanString(value: unknown, maximum: number, allowEmpty: boolean): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFC').trim();
  const length = [...clean].length;
  if (length > maximum || (!allowEmpty && length === 0) || !validPublicText(clean)) return null;
  return clean;
}

export function parseDraft(raw: unknown): { value: DraftInput } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'invalid_profile' };
  const data = raw as Record<string, unknown>;
  const allowed = new Set(['expectedVersion', 'displayName', 'bio', 'interests', 'intention']);
  if (Object.keys(data).some((key) => !allowed.has(key))) return { error: 'invalid_profile_fields' };
  const v = data.expectedVersion;
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > 1000000000) return { error: 'invalid_profile_version' };
  const name = cleanString(data.displayName, 60, true);
  const bio = cleanString(data.bio, 500, true);
  const intention = cleanString(data.intention, 80, true);
  if (name === null || bio === null || intention === null) return { error: 'invalid_profile_text' };
  if (!Array.isArray(data.interests) || data.interests.length > 10) return { error: 'invalid_interests' };
  const seen = new Set<string>();
  const interests: string[] = [];
  for (const interest of data.interests) {
    const cleaned = cleanString(interest, 32, false);
    if (!cleaned || !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '&-]*$/u.test(cleaned)) return { error: 'invalid_interests' };
    const key = cleaned.toLocaleLowerCase('en-US');
    if (seen.has(key)) return { error: 'duplicate_interests' };
    seen.add(key);
    interests.push(cleaned);
  }
  return { value: { expectedVersion: v as number, displayName: name, bio, intention, interests } };
}

export function parseHandleInput(raw: unknown): { value: { handle: string; expectedRevision: number } } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'invalid_handle' };
  const data = raw as Record<string, unknown>;
  if (Object.keys(data).some((k) => !['handle', 'expectedRevision'].includes(k))) return { error: 'invalid_handle' };
  const handle = normalizeHandle(data.handle);
  const revision = data.expectedRevision;
  if (!handle) return { error: 'invalid_handle' };
  if (!Number.isSafeInteger(revision) || (revision as number) < 1 || (revision as number) > 1000000000)
    return { error: 'invalid_identity_revision' };
  return { value: { handle, expectedRevision: revision as number } };
}

export function parseMode(value: unknown): ProfileMode | null {
  return value === 'dating' || value === 'friendship' ? value : null;
}

export function draftMissing(fields: DraftFields, handle: string | null, locality: string | null, photos: readonly string[] = []): string[] {
  const missing: string[] = [];
  if (!handle) missing.push('handle');
  if (!fields.displayName) missing.push('displayName');
  if (!fields.intention) missing.push('intention');
  if (photos.length < 2) missing.push('photos');
  if (!locality) missing.push('locality');
  return missing;
}
