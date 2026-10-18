/**
 * How long a message is shown as being typed. Based on 75% of a fast typist's speed
 * (120 words per minute, 5 characters per word = 10 characters per second), so 7.5 characters per second.
 * Every message is capped at MAX_WORDS, and the delay never exceeds MAX_DELAY_MS (6.5 seconds).
 */
export const TYPING_WPM = 120;
export const CHARS_PER_WORD = 5;
export const TYPING_SPEED_FRACTION = 0.75;
export const MAX_WORDS = 9;
export const MAX_DELAY_MS = 6500;

export function typingDelayMs(text: string): number {
  const charsPerSecond = (TYPING_WPM * CHARS_PER_WORD) / 60;
  const ms = Math.round((text.length / (charsPerSecond * TYPING_SPEED_FRACTION)) * 1000);
  return Math.min(ms, MAX_DELAY_MS);
}

/** Keep at most `max` words, cutting at the last full sentence if one fits, otherwise at the last word. */
export function limitWords(text: string, max = MAX_WORDS): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  const cut = words.slice(0, max).join(" ");
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("!"));
  if (lastStop > cut.length * 0.5) return cut.slice(0, lastStop + 1);
  return cut.replace(/[,;:]$/, "") + "?";
}
