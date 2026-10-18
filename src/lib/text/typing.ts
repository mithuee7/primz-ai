/**
 * How long a person would take to type a message, at 75% of normal typing speed.
 * Average typing: 40 words per minute, 5 characters per word, so about 3.3 characters per second.
 * 75% of that is about 2.5 characters per second.
 */
export const TYPING_WPM = 40;
export const CHARS_PER_WORD = 5;
export const TYPING_SPEED_FRACTION = 0.75;

export function typingDelayMs(text: string): number {
  const charsPerSecond = (TYPING_WPM * CHARS_PER_WORD) / 60;
  const seconds = text.length / (charsPerSecond * TYPING_SPEED_FRACTION);
  return Math.round(seconds * 1000);
}
