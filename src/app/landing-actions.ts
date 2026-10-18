"use server";

import { PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { capitalise } from "@/lib/text/capitalise";
import { GroqClient } from "@/lib/services/llm/groq";
import { LLMError } from "@/lib/services/llm/types";

const DEMO_MODEL = process.env.DEMO_GROQ_MODEL || "qwen/qwen3.8-27b";
const MAX_MESSAGES = 15;
/** Message count from which both sides steer to a booked call. */
const CLOSE_AFTER = 10;

export interface DemoMessage {
  from: "us" | "lead";
  text: string;
}

const PRICE_FACTS = PLANS.map(
  (p) => `- ${p.name}: ₹${p.price.toLocaleString("en-IN")}/month, ${p.accounts} Instagram account${p.accounts > 1 ? "s" : ""}, ${p.chatsPerAccount} chats per account. ${p.keys}.`,
).join("\n");

const OWNER_SYSTEM = `You are the owner of a small AI agency that builds Instagram DM assistants. You are chatting with a business owner on Instagram to book a short call.

How a good sales DM goes (follow it):
- Short messages, one or two sentences, like a real person on a phone. No bullet points, no emojis, no em dashes. Never repeat the same phrase twice in the chat.
- Answer what they asked directly first, then move forward. If they ask about price, give the real number.
- Acknowledge objections honestly ("fair, that's a lot to pay for") before reframing. Never argue.
- Find out the number they can actually afford, then fit a plan to it. Don't guess.
- Negotiation: you may move down one plan tier to fit their budget, and you may offer a smaller starting setup. Never give a discount below the cheapest plan. Trade every concession for a commitment ("if the Starter plan works, can we do a 10 minute call Thursday?").
- Keep the tone warm and positive from start to finish. The chat should end with a clear yes: a call booked, or the lead agreeing to a specific plan and next step.
- Don't pressure. If they say they want text only, agree and send the plan in text.

Facts you may use (never invent others):
${PRICE_FACTS}

Return ONLY JSON: {"reply": "...", "booked": true|false}. Set "booked" to true only when a specific next step is agreed (a call time, or a plan they chose). Otherwise false.`;

const LEAD_SYSTEM = `You play a real small business owner who runs ads and gets many Instagram DMs. You are busy, honest, and reasonable. Your budget is limited (about ₹1,000 to ₹2,000 a month at most). You don't want to waste time.

How a real buyer behaves in this kind of DM:
- Short replies, one or two sentences, casual, normal capitalisation. No emojis. No long speeches.
- You admit your real problem (too many DMs, slow replies, leads going cold).
- You ask about price directly and you push back on high numbers with a specific counter, not a fake one.
- When a sensible offer fits your budget, you accept it warmly and agree to the next step (a call time or the plan). You don't invent new objections once a fair offer is on the table.
- The conversation should end positive: you agree to the next step.

Return ONLY JSON: {"reply": "..."}`;

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
  // Late in the chat both sides steer to a call: the owner proposes a specific time, the lead accepts it.
  const closing = clean.length >= CLOSE_AFTER;
  const ownerSystem = closing ? `${OWNER_SYSTEM}\n\nCLOSING NOW: propose one specific call time (day and clock time) and ask them to confirm it. Set "booked" to true.` : OWNER_SYSTEM;
  const leadSystem = closing && !isOwner ? `${LEAD_SYSTEM}\n\nThe other person has offered a call. Accept the proposed time warmly and confirm it.` : LEAD_SYSTEM;

  try {
    const raw = await new GroqClient(key).complete({
      purpose: "conversation",
      model: DEMO_MODEL,
      system: isOwner ? ownerSystem : leadSystem,
      user: `CONVERSATION\n${transcript(clean)}\n\nWrite the next message for ${isOwner ? "YOU" : "THEM"}.`,
      temperature: 0.8,
      maxTokens: 160,
      timeoutMs: 15000,
    });
    const parsed = JSON.parse(raw) as { reply?: unknown; booked?: unknown };
    const text = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!text) return { ok: false, error: "No reply came back. Try again." };
    // A closing owner turn always books the call, so every run ends in a booked call.
    const booked = isOwner && (closing || parsed.booked === true);
    return { ok: true, text: capitalise(text.slice(0, 400)), booked };
  } catch (err) {
    const detail = err instanceof LLMError ? err.message : "unexpected error";
    return { ok: false, error: `The demo couldn't reach the AI (${detail}).` };
  }
}
