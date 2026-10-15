import Link from "next/link";
import { ScrollText } from "lucide-react";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { listActivity, type ActivityLevel } from "@/lib/services/activity-log";

export const metadata = { title: "Logs" };

const LEVEL_TONE: Record<ActivityLevel, "green" | "amber" | "red" | "neutral"> = {
  success: "green",
  info: "neutral",
  warn: "amber",
  error: "red",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default async function LogsPage() {
  const user = await requireUser();
  const entries = await listActivity(user.id, 200);

  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <AutoRefresh intervalMs={10000} />
      <PageHeader title="Logs" description="What the AI did for each lead, and why something failed or was held back. Newest first." />
      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No activity yet" description="Replies, skips, checker decisions and errors show up here as they happen." />
      ) : (
        <Card className="mx-auto max-w-4xl divide-y divide-zinc-100 overflow-hidden">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-3">
              <div className="flex shrink-0 items-center gap-2 sm:w-44">
                <Badge tone={LEVEL_TONE[e.level]}>{e.level}</Badge>
                <span className="text-[11px] text-zinc-500">{formatTime(e.created_at)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-zinc-900">
                  <span className="mr-1.5 font-mono text-[11px] text-zinc-500">[{e.step}]</span>
                  {e.message}
                </p>
                {e.conversation_id ? (
                  <Link href={`/chats/${e.conversation_id}`} className="text-xs text-blue-600 hover:underline">
                    Open chat
                  </Link>
                ) : null}
                {e.details ? (
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-600">{JSON.stringify(e.details, null, 2)}</pre>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
