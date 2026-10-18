/** Capitalise the first letter of each sentence. */
export function capitalise(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase());
}
