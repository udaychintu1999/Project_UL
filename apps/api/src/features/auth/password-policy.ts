/** P01-2 target password policy: NIST SP 800-63B-4 single-factor requirements.
 * Limits bound Argon2 input memory; existing legacy hashes are still verifiable.
 */
export const PASSWORD_MIN_LENGTH=15;
export const PASSWORD_MAX_CODEPOINTS=256;
export const PASSWORD_MAX_BYTES=1024;
export const LOGIN_WINDOW_SECONDS=15*60;
export const LOGIN_ATTEMPT_LIMIT=10;
export const PASSWORD_RECENT_AUTH_SECONDS=10*60;
export const PASSWORD_RESET_LIFETIME_SECONDS=10*60;

/** Normalize new credentials consistently; never lowercase, trim or truncate. */
export function canonicalPassword(password:string):string {return password.normalize('NFC');}
export function validPassword(input:unknown):input is string {
  if(typeof input!=='string') return false;
  const candidate=canonicalPassword(input);
  const length=Array.from(candidate).length;
  return length>=PASSWORD_MIN_LENGTH && length<=PASSWORD_MAX_CODEPOINTS &&
    Buffer.byteLength(candidate,'utf8')<=PASSWORD_MAX_BYTES &&
    !/[\u0000-\u001F\u007F]/.test(candidate);
}
/** Built-in baseline blocklist; production must provision a vetted larger corpus.
 * Whole-password comparisons only. Never send passwords to third-party services.
 */
const obvious=new Set([
  'password','password1','password123','password123456','password123456789',
  '123456789012345','1234567890123456','12345678901234567890',
  'qwerty123456789','qwertyuiopasdfgh','qwerty1234567890',
  'correcthorsebatterystaple','iloveyouiloveyou','welcome123456789',
  'password!','password@123','password123456!','admin12345678901',
  'uluvpassword12345','uluvpassword123456',
]);
export function compromisedCandidate(password:string):boolean {
  return obvious.has(canonicalPassword(password).toLowerCase());
}
export function remainingWindow(windowEnd:number,now:number):boolean {
  return Number.isSafeInteger(windowEnd)&&windowEnd>now;
}
