import "server-only";
import { createAdminClient } from "@/lib/supabase/clients";
import { logActivity } from "./activity-log";

/** Inbound messages plus AI sends in one minute. Above RATE_LIMIT the replies pause for that moment. Above REVIEW the account is flagged. */
export const RATE_LIMIT_PER_MINUTE = 30;
export const REVIEW_PER_MINUTE = 80;

export type AbuseVerdict =
  | { action: "ok" }
  | { action: "rate_limited"; reason: string }
  | { action: "flagged"; reason: string };

/** Counts recent traffic for one owner. Flags the account for review when it is far beyond human speed. */
export async function checkAbuse(ownerId: string): Promise<AbuseVerdict> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await db
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .in("step", ["inbound", "send"])
    .gte("created_at", since);
  if (error) return { action: "ok" }; // a counting error must not block every reply
  const n = count ?? 0;

  if (n >= REVIEW_PER_MINUTE) {
    const reason = `${n} messages in one minute`;
    const now = new Date().toISOString();
    await db
      .from("user_plans")
      .update({ review_status: "review", review_reason: `Abuse check: ${reason}`, flagged_at: now, updated_at: now })
      .eq("owner_id", ownerId);
    await logActivity({
      ownerId,
      level: "warn",
      step: "review",
      message: `Account flagged for review: ${reason}. AI replies are paused until an admin checks it.`,
    });
    return { action: "flagged", reason };
  }
  if (n >= RATE_LIMIT_PER_MINUTE) {
    return { action: "rate_limited", reason: `Too many messages in the last minute (${n}). Replies pause for a moment.` };
  }
  return { action: "ok" };
}
