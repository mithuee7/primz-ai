"use server";

import { rateLimit } from "@/lib/rate-limit";
import { GroqClient } from "@/lib/services/llm/groq";
import { LLMError } from "@/lib/services/llm/types";

const DEMO_MODEL = "llama-3.3-70b-versatile";
const MAX_MESSAGES = 15;

export interface DemoMessage {
  from: "us" | "lead";
  text: string;
}

const OWNER_SYSTEM = `You reply to Instagram DMs for a small AI agency. Your goal: get the lead onto a short call. Keep replies to one or two short, casual sentences, like a real person typing on a phone. Ask at most one question. Never mention being an AI. When the lead agrees to a call or gives a time, confirm it and set "booked" to true. Otherwise "booked" is false. Return ONLY JSON: {"reply": "...", "booked": true|false}`;

const LEAD_SYSTEM = `You play a small business owner who gets many Instagram DMs and is busy and a bit skeptical. You are slow to answer and you tell the truth about your problem: lots of DMs, not enough time, leads going cold. Reply in one or two short, casual lowercase sentences. You only agree to a call when the other person has made a clear, specific offer that fits your problem. Return ONLY JSON: {"reply": "..."}`;

function transcript(history: DemoMessage[]): string {
  return history.map((m) => `${m.from === "lead" ? "THEM" : "YOU"}: ${m.text}`).join("\n");
}

/**
 * Writes the next message in the homepage demo. Both sides are AI: the owner's side
 * books a call, the lead's side answers as a skeptical business owner. Uses a dedicated
 * demo key and a global rate limit so the public page can't run up your bill.
 */
export async function demoTurnAction(
  history: DemoMessage[],
): Promise<{ ok: true; text: string; booked: boolean } | { ok: false; error: string }> {
  const key = process.env.DEMO_GROQ_API_KEY;
  if (!key) return { ok: false, error: "The live demo is offline right now." };
  if (history.length === 0 || history.length >= MAX_MESSAGES) return { ok: false, error: "Demo finished." };

  const rl = rateLimit("landing-demo:global", 400, 60 * 60 * 1000);
  if (!rl.ok) return { ok: false, error: "The demo is busy. Try again in a few minutes." };

  const clean = history.slice(-12).map((m) => ({ from: m.from === "lead" ? "lead" : "us", text: String(m.text).slice(0, 300) }) as DemoMessage);
  const next: "us" | "lead" = clean[clean.length - 1]!.from === "us" ? "lead" : "us";
  const isOwner = next === "us";

  try {
    const raw = await new GroqClient(key).complete({
      purpose: "conversation",
      model: DEMO_MODEL,
      system: isOwner ? OWNER_SYSTEM : LEAD_SYSTEM,
      user: `CONVERSATION\n${transcript(clean)}\n\nWrite the next message for ${isOwner ? "YOU" : "THEM"}.`,
      temperature: 0.8,
      maxTokens: 160,
      timeoutMs: 15000,
    });
    const parsed = JSON.parse(raw) as { reply?: unknown; booked?: unknown };
    const text = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!text) return { ok: false, error: "No reply came back. Try again." };
    return { ok: true, text: text.slice(0, 400), booked: isOwner && parsed.booked === true };
  } catch (err) {
    const detail = err instanceof LLMError ? err.message : "unexpected error";
    return { ok: false, error: `The demo couldn't reach the AI (${detail}).` };
  }
}
