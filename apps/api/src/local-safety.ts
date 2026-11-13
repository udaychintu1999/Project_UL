/** P00–P16: fail closed to loopback DynamoDB Local. No network call is made here. */
export function assertLocalDynamoEndpoint(value: string | undefined): string {
  if (!value) throw new Error('DYNAMODB_ENDPOINT required for Java DynamoDB Local; never fall back to AWS.');
  let url: URL;
  try {url = new URL(value);} catch {throw new Error('Invalid DYNAMODB_ENDPOINT; only loopback HTTP is allowed.');}
  if (url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Only a loopback HTTP DynamoDB Local endpoint is permitted in the starter.');
  }
  return url.toString();
}

/** Real AWS media must never be used by default or enabled by ambient credentials. */
export function assertLocalMediaDriver(driver: string | undefined): 'local' {
  if ((driver ?? 'local') !== 'local') {
    throw new Error('P00 starter permits only local media. DEV AWS integration requires a later explicitly authorized implementation and owner-managed runtime.');
  }
  return 'local';
}
