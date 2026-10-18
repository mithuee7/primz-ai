import "server-only";
import { isDemoMode } from "@/lib/env";
import { tryDecrypt } from "@/lib/secrets";
import type { AppSettings } from "@/lib/types";
import { DemoLLM } from "./demo";
import { GroqMultiClient } from "./groq-multi";
import { makeProviderClient, PROVIDER_DEFAULT_MODEL, type AiProvider } from "./providers";
import { LLMError, type LLMClient } from "./types";

/** The owner's saved Groq keys (comma separated when several). Null if none. */
export function resolveGroqKey(settings: AppSettings): { keys: string[]; source: "settings" | "none" } {
  const saved = tryDecrypt(settings.groq_key_encrypted); // null if missing or unreadable (service key rotated)
  if (saved) {
    const keys = saved.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length) return { keys, source: "settings" };
  }
  return { keys: [], source: "none" };
}

/** Models the pipeline uses. A custom provider uses its own model for both roles. */
export function conversationModel(settings: AppSettings): string {
  if (settings.ai_provider !== "groq" && settings.ai_model) return settings.ai_model;
  return settings.groq_model;
}

export function checkerModel(settings: AppSettings): string {
  if (settings.ai_provider !== "groq" && settings.ai_model) return settings.ai_model;
  return settings.checker_model;
}

export interface LlmStatus {
  provider: "groq" | "openai" | "anthropic" | "gemini" | "demo" | "none";
  source: "settings" | "platform" | "none";
}

/** For display only. Never includes a key. */
export function getLlmStatus(settings: AppSettings): LlmStatus {
  if (settings.ai_provider !== "groq" && tryDecrypt(settings.ai_key_encrypted)) return { provider: settings.ai_provider, source: "settings" };
  const { keys, source } = resolveGroqKey(settings);
  if (keys.length) return { provider: "groq", source };
  return { provider: isDemoMode() ? "demo" : "none", source: "none" };
}

/**
 * Picks the AI for one reply:
 *  1. The provider the owner chose, with their own key (OpenAI, Anthropic or Gemini)
 *  2. Their saved Groq keys
 *  3. Platform Groq keys, only for an active Basic plan (passed in by the caller)
 *  4. The scripted demo LLM in demo mode
 *  5. Otherwise: not configured, so the pipeline fails closed and nothing is sent
 */
export function resolveLLM(settings: AppSettings, opts: { platformGroqKeys?: string[] } = {}): LLMClient {
  if (settings.ai_provider !== "groq") {
    const key = tryDecrypt(settings.ai_key_encrypted);
    const client = key ? makeProviderClient(settings.ai_provider as AiProvider, key) : null;
    if (client) return client;
  }
  const { keys } = resolveGroqKey(settings);
  if (keys.length) return new GroqMultiClient(keys);
  if (opts.platformGroqKeys?.length) return new GroqMultiClient(opts.platformGroqKeys);
  if (isDemoMode()) return new DemoLLM();
  throw new LLMError("No AI is configured. Choose a provider and add your key in Settings.", "not_configured", false);
}

export { PROVIDER_DEFAULT_MODEL };
