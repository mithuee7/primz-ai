"use server";

import { rateLimit } from "@/lib/rate-limit";
import { GroqClient } from "@/lib/services/llm/groq";

const DEMO_MODEL = "llama-3.3-70b-versatile";

export interface DemoTurn {
  role: "lead" | "ai";
  text: string;
}

/**
 * Writes one AI reply for the homepage demo. The lead's messages are fixed in the page;
 * only our side is generated live. Uses a dedicated demo key and a global rate limit,
 * so the public page can't run up your bill.
 */
export async function demoReplyAction(history: DemoTurn[]): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const key = process.env.DEMO_GROQ_API_KEY;
  if (!key) return { ok: false, error: "The live demo is offline right now." };

  const rl = rateLimit("landing-demo:global", 200, 60 * 60 * 1000);
  if (!rl.ok) return { ok: false, error: "The demo is busy. Try again in a few minutes." };

  const turns = history.slice(-6).map((t) => ({ role: t.role, text: String(t.text).slice(0, 300) }));
  const transcript = turns.map((t) => `${t.role === "lead" ? "THEM" : "YOU"}: ${t.text}`).join("\n");

  const system = `You reply to Instagram DMs as the owner of a small AI agency that builds DM assistants for businesses. Reply in one or two short, casual sentences, like a real person typing on their phone. Ask at most one question. Never mention being an AI. Return ONLY a JSON object: {"reply": "..."}`;

  try {
    const raw = await new GroqClient(key).complete({
      purpose: "conversation",
      model: DEMO_MODEL,
      system,
      user: `CONVERSATION\n${transcript}\n\nWrite YOUR next reply.`,
      temperature: 0.7,
      maxTokens: 150,
      timeoutMs: 15000,
    });
    const parsed = JSON.parse(raw) as { reply?: unknown };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) return { ok: false, error: "No reply came back. Try again." };
    return { ok: true, reply: reply.slice(0, 400) };
  } catch {
    return { ok: false, error: "The demo couldn't reach the AI. Try again." };
  }
}
