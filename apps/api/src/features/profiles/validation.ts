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

/** Shared profile belongs to the account, not either connection mode.
 *  Locality is explicitly self-declared and never trusted as a discovery cell.
 */
export type SetupSelections = { dating: boolean; friendship: boolean };
export type SharedSetup = {
  commonName: string;
  locality: string;
  gender: '' | 'woman' | 'man' | 'non_binary' | 'another_identity' | 'prefer_not_to_say';
  selectedModes: SetupSelections;
};
export type SetupInput = SharedSetup & { expectedRevision: number };

const allowedGenders = new Set(['', 'woman', 'man', 'non_binary', 'another_identity', 'prefer_not_to_say']);

export function parseSetup(raw: unknown): { value: SetupInput } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'invalid_shared_profile' };
  const data = raw as Record<string, unknown>;
  const allowed = new Set(['expectedRevision', 'commonName', 'locality', 'gender', 'selectedModes']);
  if (Object.keys(data).some((key) => !allowed.has(key))) return { error: 'invalid_shared_profile_fields' };
  const revision = data.expectedRevision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0 || (revision as number) > 1_000_000_000) {
    return { error: 'invalid_setup_revision' };
  }
  const commonName = cleanString(data.commonName, 60, true);
  if (commonName === null) return { error: 'invalid_common_name' };
  // A broad city/locality label only. Never accept address numbers, GPS,
  // postcodes, URL or precise coordinates as a trusted discovery location.
  const locality = cleanString(data.locality, 60, true);
  if (locality === null || (locality.length > 0 && !/^[\p{L}\p{M}][\p{L}\p{M} '\-]{1,59}$/u.test(locality))) {
    return { error: 'invalid_broad_locality' };
  }
  const gender = data.gender;
  if (typeof gender !== 'string' || !allowedGenders.has(gender)) return { error: 'invalid_gender' };
  const selections = data.selectedModes;
  if (!selections || typeof selections !== 'object' || Array.isArray(selections)) {
    return { error: 'invalid_mode_selection' };
  }
  const modes = selections as Record<string, unknown>;
  if (Object.keys(modes).some((key) => key !== 'dating' && key !== 'friendship') ||
      typeof modes.dating !== 'boolean' || typeof modes.friendship !== 'boolean') {
    return { error: 'invalid_mode_selection' };
  }
  return { value: {
    expectedRevision: revision as number, commonName, locality,
    gender: gender as SharedSetup['gender'],
    selectedModes: { dating: modes.dating as boolean, friendship: modes.friendship as boolean }
  } };
}

/** Entering the main app requires two READY, owner-verified, mode-assigned
 * photos for EVERY enabled mode. Drafts may still be saved with zero photos.
 * This is NOT public discovery activation (P02-3 remains separate).
 * Caller must supply only photo IDs verified against the owner's READY records.
 */
export function onboardingMissing(
  handle: string | null, shared: SharedSetup,
  profiles: Partial<Record<ProfileMode, (DraftFields & { photoIds: readonly string[] }) | undefined>>
): string[] {
  const missing: string[] = [];
  if (!handle) missing.push('handle');
  if (!shared.commonName) missing.push('commonName');
  if (!shared.locality) missing.push('locality');
  // An explicit selection is required; 'prefer_not_to_say' remains a valid
  // privacy-preserving answer. Empty is allowed in saved drafts, not onboarding.
  if (!shared.gender) missing.push('gender');
  if (!shared.selectedModes.dating && !shared.selectedModes.friendship) missing.push('selectMode');
  for (const mode of ['dating', 'friendship'] as const) {
    if (!shared.selectedModes[mode]) continue;
    const profile = profiles[mode];
    if (!profile) { missing.push(`${mode}.draft`); continue; }
    if (!(profile.displayName || shared.commonName)) missing.push(`${mode}.displayName`);
    if (!profile.bio) missing.push(`${mode}.bio`);
    if (!profile.intention) missing.push(`${mode}.intention`);
    if (profile.interests.length === 0) missing.push(`${mode}.interests`);
    if (new Set(profile.photoIds).size < 2) missing.push(`${mode}.photos`);
  }
  return missing;
}

/** Age from self-declared signup DOB, computed server-side at UTC day boundary. */
export function ageFromBirthDate(value: unknown, now = new Date()): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(now.getTime())) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age--;
  return age >= 18 && age <= 130 ? age : null;
}
