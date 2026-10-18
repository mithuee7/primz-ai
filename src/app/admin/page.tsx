import { createAdminClient } from "@/lib/supabase/clients";
import { ACTIVATION_WAIT_MS } from "@/lib/plan-state";
import { isAdmin } from "./auth";
import { AdminLogin } from "./admin-login";
import { AdminPlans, type AdminRow } from "./admin-plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  const db = createAdminClient();
  const { data } = await db
    .from("user_plans")
    .select("owner_id, plan_code, status, requested_at, activated_at, expires_at, profiles(email, display_name)")
    .order("requested_at", { ascending: false, nullsFirst: false });

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
    eligibleAt: r.requested_at ? new Date(new Date(r.requested_at).getTime() + ACTIVATION_WAIT_MS).toISOString() : null,
  }));

  return <AdminPlans rows={rows} />;
}
