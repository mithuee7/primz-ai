import "server-only";
import type { AiProvider } from "./providers";

const TIMEOUT_MS = 10_000;

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("The provider rejected this key.");
    if (!res.ok) throw new Error(`The provider returned an error (${res.status}).`);
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("The provider took too long to respond.");
    if (err instanceof Error && err.message.startsWith("The provider")) throw err;
    throw new Error("Could not reach the provider.");
  } finally {
    clearTimeout(timer);
  }
}

const NON_CHAT = /whisper|tts|guard|embed|moderation|dall|image|audio|realtime|transcribe|search|orpheus/i;

/** Model ids the given key can use, sorted. Chat-capable models only. */
export async function listProviderModels(provider: AiProvider, apiKey: string): Promise<string[]> {
  if (provider === "groq") {
    const json = (await getJson("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${apiKey}` })) as { data?: Array<{ id?: string }> };
    return (json.data ?? []).map((m) => m.id ?? "").filter((id) => id && !NON_CHAT.test(id)).sort();
  }
  if (provider === "openai") {
    const json = (await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` })) as { data?: Array<{ id?: string }> };
    return (json.data ?? [])
      .map((m) => m.id ?? "")
      .filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !NON_CHAT.test(id))
      .sort();
  }
  if (provider === "anthropic") {
    const json = (await getJson("https://api.anthropic.com/v1/models?limit=100", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" })) as { data?: Array<{ id?: string }> };
    return (json.data ?? []).map((m) => m.id ?? "").filter(Boolean).sort();
  }
  const json = (await getJson("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { "x-goog-api-key": apiKey })) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  return (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id) => id && !NON_CHAT.test(id))
    .sort();
}
