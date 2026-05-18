/** Generate a short unique id (9 base-36 chars, ~10^14 space, sufficient for a personal tracker). */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 11)
}
