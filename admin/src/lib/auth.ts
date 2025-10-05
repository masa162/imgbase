/**
 * Build Basic Authentication header
 * Edge Runtime compatible (uses btoa instead of Buffer)
 */
export function buildBasicAuthHeader(user: string, password: string): string {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
