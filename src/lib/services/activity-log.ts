import "server-only";
import { createAdminClient } from "@/lib/supabase/clients";

export type ActivityLevel = "info" | "success" | "warn" | "error";

export interface ActivityEntry {
  id: string;
  owner_id: string;
  conversation_id: string | null;
  level: ActivityLevel;
  step: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface LogInput {
  ownerId: string;
  conversationId?: string | null;
  level: ActivityLevel;
  step: string;
  message: string;
  details?: Record<string, unknown> | null;
}

/**
 * Writes one activity row. Never throws: logging must not break replies.
 * Skipped under tests so the suite doesn't need a database.
 */
export async function logActivity(input: LogInput): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  try {
    const { error } = await createAdminClient()
      .from("activity_logs")
      .insert({
        owner_id: input.ownerId,
        conversation_id: input.conversationId ?? null,
        level: input.level,
        step: input.step,
        message: input.message.slice(0, 2000),
        details: input.details ?? null,
      });
    if (error) console.error("[activity-log] insert failed:", error.message);
  } catch (err) {
    console.error("[activity-log] failed:", err instanceof Error ? err.message : String(err));
  }
}

export async function listActivity(ownerId: string, limit = 200): Promise<ActivityEntry[]> {
  const { data, error } = await createAdminClient()
    .from("activity_logs")
    .select("id, owner_id, conversation_id, level, step, message, details, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load logs: ${error.message}`);
  return (data ?? []) as ActivityEntry[];
}
