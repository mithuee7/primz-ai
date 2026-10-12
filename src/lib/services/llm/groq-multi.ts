import "server-only";
import { LLMError, type LLMClient, type LLMRequest } from "./types";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface GroqResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  error?: { message?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Multi-key Groq client that rotates through multiple API keys to distribute load
 * and avoid hitting rate limits on a single key.
 */
export class GroqMultiClient implements LLMClient {
  readonly provider = "groq" as const;
  private keys: string[];
  private keyIndex = 0;
  private keyFailures = new Map<string, number>(); // Track failures per key

  constructor(apiKeys: string | string[]) {
    // Support both single key (for backward compat) and multiple keys
    this.keys = Array.isArray(apiKeys) ? apiKeys.filter((k) => k && k.trim()) : [apiKeys].filter((k) => k && k.trim());
    if (this.keys.length === 0) {
      throw new Error("At least one Groq API key is required");
    }
  }

  private getNextKey(): string {
    if (this.keys.length === 1) return this.keys[0]!;

    // Find the key with the least failures
    let bestKey = this.keys[this.keyIndex]!;
    let leastFailures = this.keyFailures.get(bestKey) ?? 0;

    for (const key of this.keys) {
      const failures = this.keyFailures.get(key) ?? 0;
      if (failures < leastFailures) {
        bestKey = key;
        leastFailures = failures;
      }
    }

    // Move to next key for next call (round-robin)
    this.keyIndex = (this.keyIndex + 1) % this.keys.length;
    return bestKey;
  }

  private recordFailure(key: string, isRateLimit: boolean) {
    if (isRateLimit) {
      // Rate limit failures count heavily - skip this key more often
      this.keyFailures.set(key, (this.keyFailures.get(key) ?? 0) + 3);
    } else {
      // Other failures count less
      this.keyFailures.set(key, (this.keyFailures.get(key) ?? 0) + 1);
    }
  }

  private recordSuccess(key: string) {
    // Gradually reduce failure count on success
    const current = this.keyFailures.get(key) ?? 0;
    if (current > 0) {
      this.keyFailures.set(key, Math.max(0, current - 1));
    }
  }

  async complete(req: LLMRequest): Promise<string> {
    let lastError: LLMError | null = null;
    const keysToTry = this.keys.length > 1 ? Math.min(3, this.keys.length) : 1;

    for (let attempt = 0; attempt < keysToTry; attempt++) {
      try {
        const key = this.getNextKey();
        const result = await this.once(req, key);
        this.recordSuccess(key);
        return result;
      } catch (err) {
        if (!(err instanceof LLMError)) throw err;
        lastError = err;

        const key = this.keys[this.keyIndex]!;
        const isRateLimit = err.kind === "rate_limit";
        this.recordFailure(key, isRateLimit);

        // Don't retry if it's not retryable
        if (!err.retryable) break;

        // On rate limit, try next key immediately
        if (isRateLimit) {
          console.log(`[groq-multi] Rate limit on key ${this.keyIndex}, trying next key`);
          continue;
        }

        // On other retryable errors, wait a bit
        await sleep(attempt === 0 ? 900 : 0);
      }
    }

    throw lastError ?? new LLMError("Groq request failed on all keys", "network", false);
  }

  private async once(req: LLMRequest, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    let res: Response;

    try {
      const payload: Record<string, unknown> = {
        model: req.model,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      };

      res = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new LLMError(`Groq request timed out after ${req.timeoutMs}ms`, "timeout", true);
      }
      throw new LLMError("Could not reach Groq", "network", true);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) throw new LLMError("Groq rate limit hit", "rate_limit", true);
    if (res.status === 401 || res.status === 403) throw new LLMError("Groq rejected the API key", "http", false);
    if (res.status >= 500) throw new LLMError(`Groq server error (${res.status})`, "http", true);

    let body: GroqResponse;
    try {
      body = (await res.json()) as GroqResponse;
    } catch {
      throw new LLMError("Groq returned a non-JSON response", "http", false);
    }
    if (!res.ok) throw new LLMError(`Groq error ${res.status}: ${body.error?.message ?? "unknown"}`, "http", false);

    const choice = body.choices?.[0];
    const content = choice?.message?.content;
    if (!content || !content.trim()) throw new LLMError("Groq returned an empty completion", "empty", true);
    if (choice?.finish_reason === "length") throw new LLMError("Groq output was cut off (max tokens)", "http", false);

    console.log(`[groq-multi] model=${req.model} response_length=${content.length}`);

    return content;
  }
}
