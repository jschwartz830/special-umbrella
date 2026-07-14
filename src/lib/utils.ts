/**
 * Generate a short unique id using crypto.getRandomValues.
 * Produces 16 random bytes encoded as a 32-character hex string (~128 bits of
 * entropy vs ~46 bits from the previous Math.random-based implementation).
 * Web Crypto is available in all target environments (modern browsers + Node 15+).
 */
export function nanoid(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
