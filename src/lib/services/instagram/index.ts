import "server-only";
import { isDemoMode } from "@/lib/env";
import { MetaInstagramService } from "./meta";
import { MockInstagramService } from "./mock";
import type { InstagramService } from "./types";

const g = globalThis as unknown as { __primzIg?: InstagramService };

/** The single place that decides which Instagram implementation is active. */
export function getInstagramService(): InstagramService {
  if (!g.__primzIg) {
    g.__primzIg = isDemoMode() ? new MockInstagramService() : new MetaInstagramService();
  }
  return g.__primzIg;
}

export * from "./types";
