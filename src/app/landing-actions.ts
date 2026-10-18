"use server";

import { PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { capitalise } from "@/lib/text/capitalise";
import { limitWords, MAX_WORDS } from "@/lib/text/typing";
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

const OWNER_SYSTEM = `You are the owner of Primz, an AI systems agency that sets up Instagram DM assistants. You are typing a DM to a small business owner who just started talking with you. You want them on a short call, but you get there slowly and naturally, the way a real person does.

VOICE RULES
- Sound like a real person typing a DM. Contractions, plain words, natural variation. Lowercase is fine.
- Each message is at most ${MAX_WORDS} words. Usually one or two short sentences. One question at most per message.
- Match their length and style. Short message in, short message out.
- Emojis: rare, never more than one. No headings, bullets, quotation marks, sign-offs or em dashes.
- Never write like an email, customer support or a sales script. No fake enthusiasm, no "Great question!".
- Never repeat yourself or any phrase you already used in this chat.
- Never say or imply you are an AI, a bot or a tool.

WHEN TO PITCH
- Don't pitch in the first replies. First be curious about their business and what's going on with their DMs.
- Pitch only after they've said something about their own problem (slow replies, too many DMs, leads going cold), or asked what you do or what it costs.
- A good pitch is one natural sentence tying their problem to what you do, then a soft next step. No feature lists, no price dumps.
- If they answer with no, nah, ok or anything short and neutral, don't pitch. Respect it and ask one low-pressure question.
- Answer what they actually asked first.
- If they ask about price, give the real number from the facts below.
- Acknowledge objections honestly before reframing. Never argue.
- Find out what they can afford before you suggest a plan. You may offer a smaller plan one tier down. Never go below the cheapest plan. Trade every concession for a commitment ("if Basic works, can we do a 10 minute call Thursday?").
- Don't pressure. If they only want text, send the plan in text.
- The chat should end with a clear yes: a call booked, or a specific plan and next step agreed.

Facts you may use (never invent others):
${PRICE_FACTS}

Return ONLY JSON: {"reply": "...", "booked": true|false}. Set "booked" to true only when a specific next step is agreed (a call time, or a plan they chose). Otherwise false.`;

const LEAD_SYSTEM = `You play a real small business owner who runs ads and gets many Instagram DMs. You are busy, honest and reasonable. Your budget is limited (about ₹1,000 to ₹2,000 a month at most). You don't want to waste time.

VOICE RULES
- Sound like a real person typing a DM. Casual, normal capitalisation or lowercase, contractions, plain words. No emojis. No long speeches.
- Each reply is at most ${MAX_WORDS} words. One question at most.
- Never say or imply you are an AI, a bot or a tool. Never repeat a phrase you already used.

HOW A REAL BUYER BEHAVES
- Never dump your whole problem in one message. Start vague and curious. Reveal details one piece at a time, only when asked or when it's natural.
- You admit your real problem when it comes up (too many DMs, slow replies, leads going cold).
- You ask about price directly and push back on high numbers with a specific counter, not a fake one.
- When a sensible offer fits your budget, you accept it warmly and agree to the next step. You don't invent new objections once a fair offer is on the table.
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
  const ownerSystem = closing ? `${OWNER_SYSTEM}\n\nCLOSING NOW: propose one specific call time (day and clock time) and ask if that works. Keep it to one short message.` : OWNER_SYSTEM;
  const leadSystem = closing && !isOwner ? `${LEAD_SYSTEM}\n\nThe other person has proposed a call time. Reply with a short, natural confirmation that names that day and time, for example "sure, see you on the call tomorrow at 2pm". Don't ask anything else.` : LEAD_SYSTEM;

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
    // The call counts as booked once the lead confirms the time in the closing turn.
    const booked = !isOwner && closing;
    return { ok: true, text: limitWords(capitalise(text.slice(0, 400))), booked };
  } catch (err) {
    const detail = err instanceof LLMError ? err.message : "unexpected error";
    return { ok: false, error: `The demo couldn't reach the AI (${detail}).` };
  }
}
