import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { getEnv, isDemoMode } from "@/lib/env";
import type { AppSettings } from "@/lib/types";
import { DemoLLM } from "./demo";
import { GroqClient } from "./groq";
import { LLMError, type LLMClient } from "./types";

/**
 * Picks the LLM provider:
 *  1. Groq key saved in Settings (decrypted server-side), else GROQ_API_KEY env
 *  2. In demo mode with no key: the scripted DemoLLM (clearly labelled in the UI)
 *  3. Otherwise: not configured -> the pipeline fails closed (nothing sent)
 */
export function resolveGroqKey(settings: AppSettings): { key: string | null; source: "settings" | "env" | "none" } {
  const env = getEnv();
  if (settings.groq_key_encrypted && env.APP_ENCRYPTION_KEY) {
    try {
      return { key: decryptSecret(settings.groq_key_encrypted, env.APP_ENCRYPTION_KEY), source: "settings" };
    } catch {
      // Unreadable (key rotated?), fall through to env
    }
  }
  if (env.GROQ_API_KEY) return { key: env.GROQ_API_KEY, source: "env" };
  return { key: null, source: "none" };
}

export type LlmStatus = { provider: "groq" | "demo" | "none"; source: "settings" | "env" | "none" };

/** For display only. Never includes the key. */
export function getLlmStatus(settings: AppSettings): LlmStatus {
  const { key, source } = resolveGroqKey(settings);
  if (key) return { provider: "groq", source };
  return { provider: isDemoMode() ? "demo" : "none", source: "none" };
}

export function resolveLLM(settings: AppSettings): LLMClient {
  const { key } = resolveGroqKey(settings);
  if (key) return new GroqClient(key);
  if (isDemoMode()) return new DemoLLM();
  throw new LLMError("Groq is not configured. Add a key in Settings or set GROQ_API_KEY.", "not_configured", false);
}
