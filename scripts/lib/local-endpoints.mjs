/** Offline/local-only URL validation shared by P00 Node maintenance/test scripts.
 * Validate BEFORE creating clients, making requests, or attaching dev tokens.
 */
export function assertLocalHttpEndpoint(value, name = 'Endpoint') {
  if (typeof value !== 'string' || !value) {
    throw new Error(`${name} must be a loopback HTTP URL`);
  }
  let url;
  try { url = new URL(value); }
  catch { throw new Error(`${name} must be a valid loopback HTTP URL`); }
  if (url.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.port || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/') {
    throw new Error(`${name} must be a loopback HTTP URL with an explicit port and no credentials, path or query`);
  }
  return url.origin;
}
