import { createAdminClient } from "@/lib/supabase/clients";
const ACTIVATE_WITHIN_MS = 48 * 60 * 60 * 1000;
import { isAdmin } from "./auth";
import { AdminLogin } from "./admin-login";
import { AdminPlans, type AdminRow } from "./admin-plans";
import { AdminReview, type FlaggedRow } from "./admin-review";
import { AdminRenewals, type RenewalRow } from "./admin-renewals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  const db = createAdminClient();
  const { data, error: plansError } = await db
    .from("user_plans")
    .select("owner_id, plan_code, status, requested_at, activated_at, expires_at, profiles(email, display_name)")
    .order("requested_at", { ascending: false, nullsFirst: false });
  if (plansError) return <p className="p-6 text-sm text-red-700">Could not load plans: {plansError.message}</p>;

  const rows: AdminRow[] = ((data ?? []) as unknown as Array<{
    owner_id: string;
    plan_code: string;
    status: AdminRow["status"];
    requested_at: string | null;
    activated_at: string | null;
    expires_at: string | null;
    profiles: { email: string | null; display_name: string | null } | null;
  }>).map((r) => ({
    ownerId: r.owner_id,
    email: r.profiles?.email ?? "unknown",
    name: r.profiles?.display_name ?? null,
    planCode: r.plan_code,
    status: r.status,
    requestedAt: r.requested_at,
    activatedAt: r.activated_at,
    expiresAt: r.expires_at,
    eligibleAt: r.requested_at ? new Date(new Date(r.requested_at).getTime() + ACTIVATE_WITHIN_MS).toISOString() : null,
  }));

  const { data: flaggedData } = await db
    .from("user_plans")
    .select("owner_id, plan_code, status, review_reason, flagged_at, profiles(email, display_name)")
    .neq("review_status", "ok")
    .order("flagged_at", { ascending: false, nullsFirst: false });
  const flaggedRaw = (flaggedData ?? []) as unknown as Array<{
    owner_id: string;
    plan_code: string;
    status: string;
    review_reason: string | null;
    flagged_at: string | null;
    profiles: { email: string | null; display_name: string | null } | null;
  }>;

  const ids = flaggedRaw.map((f) => f.owner_id);
  const { data: logData } = ids.length
    ? await db
        .from("activity_logs")
        .select("owner_id, level, step, message, created_at")
        .in("owner_id", ids)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };
  const logs = (logData ?? []) as Array<{ owner_id: string; level: string; step: string; message: string; created_at: string }>;
  const minuteAgo = Date.now() - 60_000;

  const flagged: FlaggedRow[] = flaggedRaw.map((f) => {
    const mine = logs.filter((l) => l.owner_id === f.owner_id);
    return {
      ownerId: f.owner_id,
      email: f.profiles?.email ?? "unknown",
      name: f.profiles?.display_name ?? null,
      planCode: f.plan_code,
      status: f.status,
      reason: f.review_reason ?? "Flagged",
      flaggedAt: f.flagged_at,
      lastMinute: mine.filter((l) => (l.step === "inbound" || l.step === "send") && new Date(l.created_at).getTime() >= minuteAgo).length,
      recent: mine.slice(0, 30).map((l) => ({ at: l.created_at, level: l.level, step: l.step, message: l.message })),
    };
  });

  const { data: dueData } = await db
    .from("user_plans")
    .select("owner_id, plan_code, status, expires_at, profiles(email, display_name)")
    .in("status", ["active", "expired"])
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });
  const renewals: RenewalRow[] = ((dueData ?? []) as unknown as Array<{
    owner_id: string;
    plan_code: string;
    status: string;
    expires_at: string;
    profiles: { email: string | null; display_name: string | null } | null;
  }>).map((r) => ({
    ownerId: r.owner_id,
    email: r.profiles?.email ?? "unknown",
    name: r.profiles?.display_name ?? null,
    planCode: r.plan_code,
    endedAt: r.expires_at,
  }));

  return (
    <>
      <AdminRenewals rows={renewals} />
      <AdminReview rows={flagged} />
      <AdminPlans rows={rows} />
    </>
  );
}
