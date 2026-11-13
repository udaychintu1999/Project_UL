import {createHmac, timingSafeEqual} from 'node:crypto';

export const OTP_LIFETIME_SECONDS = 600;
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_HOURLY_LIMIT = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_LIFETIME_SECONDS = 86400;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  // Deliberately conservative; no Unicode normalization/linking guesses.
  if (normalized.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(normalized)) return null;
  if (normalized.includes('..') || normalized.split('@').length !== 2) return null;
  return normalized;
}

export function isAdultBirthDate(value: unknown, now: Date): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(now.getTime())) return false;
  const [year, month, day] = value.split('-').map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() + 1 !== month || birth.getUTCDate() !== day) return false;
  if (year < 1900 || birth > now) return false;
  const limit = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return birth <= limit;
}

export function keyedHash(secret: string, purpose: string, value: string): string {
  return createHmac('sha256', secret).update(`${purpose}\0${value}`).digest('hex');
}

export function equalDigest(a: string, b: string): boolean {
  const left=Buffer.from(a,'hex'); const right=Buffer.from(b,'hex');
  return left.length === 32 && right.length === 32 && timingSafeEqual(left,right);
}

export function validOtp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}
export function bearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(value);
  return match?.[1] ?? null;
}

/** Deterministic OTP challenge state; DynamoDB transaction revalidates these conditions atomically. */
export function challengeState(expiresAt:number, attempts:number, nowSeconds:number): 'valid'|'expired'|'exhausted' {
  if (!Number.isSafeInteger(expiresAt) || expiresAt<=nowSeconds) return 'expired';
  if (!Number.isSafeInteger(attempts) || attempts>=OTP_MAX_ATTEMPTS) return 'exhausted';
  return 'valid';
}
