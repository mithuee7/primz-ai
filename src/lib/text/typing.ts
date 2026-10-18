/**
 * How long a person would take to type a message, at 75% of normal typing speed.
 * Typing: 60 words per minute, 5 characters per word, so 5 characters per second.
 * 75% of that is about 3.75 characters per second.
 */
export const TYPING_WPM = 60;
export const CHARS_PER_WORD = 5;
export const TYPING_SPEED_FRACTION = 0.75;

export function typingDelayMs(text: string): number {
  const charsPerSecond = (TYPING_WPM * CHARS_PER_WORD) / 60;
  const seconds = text.length / (charsPerSecond * TYPING_SPEED_FRACTION);
  return Math.round(seconds * 1000);
}
