import "server-only";
import { LLMError, type LLMClient, type LLMRequest } from "./types";

export type AiProvider = "groq" | "openai" | "anthropic" | "gemini";
export const CUSTOM_PROVIDERS: AiProvider[] = ["openai", "anthropic", "gemini"];

export const PROVIDER_DEFAULT_MODEL: Record<AiProvider, string> = {
  groq: "qwen/qwen3-32b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.0-flash",
};

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new LLMError(`Request timed out after ${timeoutMs}ms`, "timeout", true);
    throw new LLMError("Could not reach the AI provider", "network", true);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new LLMError("AI provider rate limit hit", "rate_limit", true);
  if (res.status === 401 || res.status === 403) throw new LLMError("The AI provider rejected the API key", "http", false);
  if (res.status >= 500) throw new LLMError(`AI provider server error (${res.status})`, "http", true);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new LLMError("AI provider returned a non-JSON response", "http", false);
  }
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? "unknown";
    throw new LLMError(`AI provider error ${res.status}: ${msg}`, "http", false);
  }
  return json;
}

/** Each provider returns a JSON object as text, the same contract as Groq. */
class OpenAIClient implements LLMClient {
  readonly provider = "openai";
  constructor(private readonly apiKey: string) {}
  async complete(req: LLMRequest): Promise<string> {
    const json = (await post(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: req.model,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      },
      req.timeoutMs,
    )) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new LLMError("The AI provider returned an empty reply", "empty", true);
    return content;
  }
}

class AnthropicClient implements LLMClient {
  readonly provider = "anthropic";
  constructor(private readonly apiKey: string) {}
  async complete(req: LLMRequest): Promise<string> {
    const json = (await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        system: `${req.system}\n\nReply with only a JSON object, no other text.`,
        messages: [{ role: "user", content: req.user }],
      },
      req.timeoutMs,
    )) as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string };
    const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    if (!text) throw new LLMError("The AI provider returned an empty reply", "empty", true);
    if (json.stop_reason === "max_tokens") throw new LLMError("AI output was cut off (max tokens)", "http", false);
    return text;
  }
}

class GeminiClient implements LLMClient {
  readonly provider = "gemini";
  constructor(private readonly apiKey: string) {}
  async complete(req: LLMRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
    const json = (await post(
      url,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens, responseMimeType: "application/json" },
      },
      req.timeoutMs,
    )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    if (!text) throw new LLMError("The AI provider returned an empty reply", "empty", true);
    return text;
  }
}

export function makeProviderClient(provider: AiProvider, apiKey: string): LLMClient | null {
  switch (provider) {
    case "openai":
      return new OpenAIClient(apiKey);
    case "anthropic":
      return new AnthropicClient(apiKey);
    case "gemini":
      return new GeminiClient(apiKey);
    default:
      return null;
  }
}
