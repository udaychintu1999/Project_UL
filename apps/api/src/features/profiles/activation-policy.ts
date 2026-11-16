/** P02-3 independent mode intent. A user-typed locality is never a trusted
 * discovery cell; public visibility stays denied until P03's atomic pointer. */
import type { DraftFields, ProfileMode, SharedSetup } from './validation.js';

export type ActivationIntent = { expectedVersion: number; active: boolean };
export function parseActivation(raw: unknown, active: boolean): { value: ActivationIntent } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'invalid_activation_request' };
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== 'expectedVersion') ||
      !Number.isSafeInteger(input.expectedVersion) ||
      Number(input.expectedVersion) < 1 || Number(input.expectedVersion) > 1000000000) {
    return { error: 'invalid_activation_request' };
  }
  return { value: { expectedVersion: input.expectedVersion as number, active } };
}

export function activationMissing(mode: ProfileMode, handle: string | null, shared: SharedSetup,
    record: (DraftFields & { photoIds: readonly string[] }) | undefined, age: number | null): string[] {
  const missing: string[] = [];
  if (!handle) missing.push('handle');
  if (!shared.commonName) missing.push('commonName');
  if (!shared.locality) missing.push('locality');
  if (!shared.gender) missing.push('gender');
  if (!shared.selectedModes[mode]) missing.push('mode_not_selected');
  if (!record) missing.push(`${mode}.draft`);
  else {
    if (!record.displayName && !shared.commonName) missing.push(`${mode}.displayName`);
    if (!record.bio) missing.push(`${mode}.bio`);
    if (!record.intention) missing.push(`${mode}.intention`);
    if (!record.interests.length) missing.push(`${mode}.interests`);
    if (new Set(record.photoIds).size < 2) missing.push(`${mode}.photos`);
  }
  if (age === null || age < 18) missing.push('ageEligibility');
  return missing;
}

export function modeVisibility(requestedActive: boolean, selected: boolean, missing: readonly string[],
    activationSetupRevision: number, currentSetupRevision: number,
    activationIdentityRevision: number, currentIdentityRevision: number): 'inactive' | 'paused_ineligible' | 'pending_trusted_locality' {
  if (!requestedActive) return 'inactive';
  if (!selected || missing.length > 0 || activationSetupRevision !== currentSetupRevision ||
      activationIdentityRevision !== currentIdentityRevision) return 'paused_ineligible';
  // P02 never publishes H3 pointers or bypasses viewer/block authorization.
  return 'pending_trusted_locality';
}

export function privatePreview(mode: ProfileMode, handle: string, shared: SharedSetup,
    record: DraftFields & { photoIds: readonly string[] }, age: number) {
  return {
    mode, handle, displayName: record.displayName || shared.commonName, age,
    broadArea: shared.locality, intention: record.intention,
    interests: record.interests.slice(0, 3), bio: record.bio,
    // IDs may only be resolved through existing authenticated *owner* media route.
    photoIds: record.photoIds.slice(0, 2), publicVisible: false
  };
}
