export type DistanceBand = '0-10' | '10-35' | '35-50' | '0-50';
export type GenderBenefit = 'woman' | 'other';

export function canonicalPair(a: string, b: string): string {
  if (!a || !b || a === b || /[#\s]/.test(a + b)) throw new Error('Invalid pair identifiers');
  const [first, second] = [a, b].sort();
  return `${first}#${second}`;
}

export function monthlyFreeCredits(benefit: GenderBenefit): number {
  return benefit === 'woman' ? 4 : 2;
}

export function creditCost(action: 'liked_you_like_back' | 'dating_connect' | 'friendship_request' | 'ordinary_like'): number {
  return action === 'ordinary_like' ? 0 : 1;
}

export function distanceBand(km: number): Exclude<DistanceBand, '0-50'> {
  if (!Number.isFinite(km) || km < 0 || km > 50) throw new RangeError('Distance must be 0–50 km');
  if (km <= 10) return '0-10';
  if (km <= 35) return '10-35';
  return '35-50';
}

export function isInsideBand(distanceKm: number, selected: DistanceBand): boolean {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return false;
  if (selected === '0-50') return distanceKm <= 50;
  if (selected === '0-10') return distanceKm <= 10;
  if (selected === '10-35') return distanceKm > 10 && distanceKm <= 35;
  return distanceKm > 35 && distanceKm <= 50;
}

export const LIMITS = Object.freeze({dailyDatingLikes:100,dailyPosts:3,activePosts:5,dailyComments:10,dailyReactions:30,photosPerPost:5,photosPerModeMin:2,photosPerModeMax:6,pendingFriendshipRequests:5});
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export function expiryTime(utcMs: number): number {
  if (!Number.isSafeInteger(utcMs) || utcMs < 0) throw new RangeError('Invalid timestamp');
  return utcMs + SEVEN_DAYS_MS;
}
